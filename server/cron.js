const cron =         require('node-cron');
const { Octokit } =  require('octokit');
const mongoose =     require('mongoose');
const models =       require('./models');
const fetch =        require('node-fetch');
require('dotenv').config();
const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });
mongoose.connect(process.env.DB_URL);

const IGNORED_REPOS = ['ITMFLtd/ITCONode', 'onitsoft/nexchange-open-client-react', 'imerkle/binbase_wallet_old', 'BizblocksChains/nexchange-open-client-react', 'Coinemy/Banano-Wallet-Fast-Robust-Secure-Wallet', 'kingspeller/-SSD-Chemical-Solution-27613119008-Activation-Powder-IN-Winchester-Wolverhampton-Worcester-Wo', 'dsvakola/Coin_sorter_counter_system', 'panapina/pina', 'Dogenano-xdg/dogenano-node'];
const KNOWN_REPOS = {
    names: ['appditto/natrium_wallet_flutter', 'appditto/pippin_nano_wallet', 'appditto/nanodart', 'appditto/natrium-wallet-server', 'appditto/natricon', 'appditto/nanopaperwallet', 'appditto/flutter_nano_ffi', 'wezrule/UE4NanoPlugin', 'wezrule/UnityNanoPlugin'],
    repos: []
};

async function refreshMisc() {
    const startTime = new Date();
    const milestones = (await octo.request('GET /repos/nanocurrency/nano-node/milestones')).data;
    const open = milestones.filter(m => m.state == 'open').sort((a,b) => (new Date(b.created_at) - new Date(a.created_at)));
    const latest = open.filter(m => m.title.toLowerCase().startsWith('v'));

    const normalized = new models.Misc({
        protocol_milestone: {
            title: latest[0]?.title || open[0]?.title || 'inactive',
            open_issues: latest[0]?.open_issues || open[0]?.open_issues || 0,
            closed_issues: latest[0]?.closed_issues || open[0]?.closed_issues || 0
        }, 
        last_updated: new Date()
    });
    await models.Misc.collection.drop();
    await models.Misc.collection.insertOne(normalized);

    const endTime = new Date();
    const timeDiff = Math.round((endTime - startTime) / 1000);
    console.log("refreshed misc in", timeDiff, "seconds");
}

async function refreshRepos() {
    const startTime = new Date(), now = new Date();
    const lastMonth = new Date(now.setDate(now.getDate()-30));

    const queries = [
        {
            topic: 'topic:nanocurrency',
            repos: []
        }, {
            topic: 'topic:cryptocurrency+topic:nano',
            repos: []
        }, {
            topic: 'topic:nano-currency',
            repos: []
        }, {
            topic: 'topic:nano-cryptocurrency',
            repos: []
        }, {
            topic: 'topic:crypto+topic:nano',
            repos: []
        }, {
            topic: 'nanocurrency+in:description',
            repos: []
        }, {
            topic: 'nano+currency+in:description',
            repos: []
        }
    ];

    for (let i = 0; i < queries.length; i++) {
        let foundAll = false, page = 1;
        while (!foundAll) {
            const res = (await octo.request('GET /search/repositories', { q: queries[i].topic, per_page: 100, page: page })).data.items;
            queries[i].repos = [...queries[i].repos, ...res];

            foundAll = res.length < 100;
            if (!foundAll) page++;
        }
    }

    for (let i = 0; i < KNOWN_REPOS.names.length; i++) {
        const res = (await octo.request(`GET /repos/${KNOWN_REPOS.names[i]}`)).data;
        KNOWN_REPOS.repos = [...KNOWN_REPOS.repos, res];
    }

    const allRepos = [...(queries.map(q => q.repos).flat()), ...KNOWN_REPOS.repos];

    const uniqueRepos = allRepos.filter(function ({ full_name }) {
        return !this.has(full_name) && this.add(full_name) && !IGNORED_REPOS.includes(full_name);
    }, new Set);

    for (let i = 0; i < uniqueRepos.length; i++) {
        let foundAll = false, page = 1;
        uniqueRepos[i].prs_30d = 0;
        while (!foundAll) {
            let pulls = (await octo.request(`GET /repos/${uniqueRepos[i].full_name}/pulls`, { per_page: 100, page: page })).data;
            pulls = pulls.filter(pr => new Date(pr.created_at) > lastMonth);
            uniqueRepos[i].prs_30d += pulls.length;

            foundAll = pulls.length < 100;
            if (!foundAll) page++;
        }
    }

    const normalized = uniqueRepos.map(({ id, name, full_name, html_url, created_at, stargazers_count, owner, prs_30d }) => new models.Repo({ id, name, full_name, html_url, created_at, stargazers_count, avatar_url: owner.avatar_url, prs_30d }));
    await models.Repo.collection.drop();
    await models.Repo.collection.insertMany(normalized);

    const endTime = new Date();
    const timeDiff = Math.round((endTime - startTime) / 1000);
    console.log("refreshed repos in", timeDiff, "seconds");

    return normalized;
}

async function refreshCommitsAndContributors(repos = []) {
    let allCommits = []; 
    const startTime = new Date();
    const now = new Date();
    const lastMonth = new Date(now.setDate(now.getDate()-30));
    const bulk = models.Repo.collection.initializeUnorderedBulkOp();

    for (let i = 0; i < repos.length; i++) {
        let foundAll = false, page = 1;
        let repo_commits_30d = 0;

        while (!foundAll) {
            let activity = (await octo.request(`GET /repos/${repos[i].full_name}/commits`, { per_page: 100, page: page, since: '2014-05-01T14:49:25Z' })).data;
            activity = activity.map(act => ({...act, repo_full_name: repos[i].full_name}));
            allCommits = [...allCommits, ...activity];

            repo_commits_30d += activity.filter(commit => commit.commit.author && new Date(commit.commit.author.date) > lastMonth).length;

            foundAll = activity.length < 100;
            if (!foundAll) page++;
        }

        bulk.find({ _id: repos[i]._id }).update(
            [{ $set: { commits_30d: repo_commits_30d } }]
        );
    }

    bulk.execute();

    const contributors = {};

    allCommits = allCommits.filter(commit => !!commit.author);

    allCommits.forEach((commit) =>{
        if (!contributors[commit.author.login]) {
            contributors[commit.author.login] = { 
                avatar_url: commit.author.avatar_url, 
                login: commit.author.login, 
                contributions: 0, 
                last_month: 0,
                repos: []
            }
        }
        if (contributors[commit.author.login]) {
            contributors[commit.author.login].contributions += 1, 
            contributors[commit.author.login].repos = [...contributors[commit.author.login].repos, commit.repo_full_name]

            if (new Date(commit.commit.author?.date) > lastMonth)
                contributors[commit.author.login].last_month += 1;
        }
    });

    const endTime1 = new Date();
    const timeDiff1 = Math.round((endTime1 - startTime) / 1000);
    console.log("fetched commits in", timeDiff1, "seconds");

    const normalizedContribs = Object.values(contributors).map(({ avatar_url, login, contributions, repos, last_month }) => new models.Contributor({ avatar_url, login, contributions, last_month, repos: [...new Set(repos)] }));
    await models.Contributor.collection.drop();
    await models.Contributor.collection.insertMany(normalizedContribs);

    const endTime2 = new Date();
    const timeDiff2 = Math.round((endTime2 - endTime1) / 1000);
    console.log("refreshed users in", timeDiff2, "seconds");

    const normalizedCommits = allCommits.map((commit) => new models.Commit({ repo_full_name: commit.repo_full_name, author: commit.author.login, date: commit.commit.author?.date }));
    await models.Commit.collection.drop();
    await models.Commit.collection.insertMany(normalizedCommits);

    const endTime3 = new Date();
    const timeDiff3 = Math.round((endTime3 - endTime2) / 1000);
    console.log("refreshed commits in", timeDiff3, "seconds");
}

async function refreshDevList() {
    const url = '/repos/Joohansson/nanodevlist/contents/donatees';
    const devs = [];
    let devsRes = (await octo.request(`GET ${url}`)).data;
    for (let i = 0; i < devsRes.length; i++) {
        const { name, github, twitter, sponsor_link, nano_account, description, tags } = await (await fetch(`${devsRes[i].download_url}`)).json();
        devs.push(new models.Profile({ name, github, twitter, sponsor_link, nano_account, description, tags }));
    }
    await models.Profile.collection.drop();
    await models.Profile.collection.insertMany(devs);
    return devs;
}

const task = cron.schedule('08 */2 * * *', async () => {
    await refreshMisc();
    const repos = await refreshRepos();
    await refreshCommitsAndContributors(repos);
});

const devListTask = cron.schedule('0,30 * * * *', async () => {
    await refreshDevList();
});