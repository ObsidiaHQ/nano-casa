const cron =         require('node-cron');
const { Octokit } =  require('octokit');
const mongoose =     require('mongoose');
const models =       require('./models');
require('dotenv').config();
const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });
mongoose.connect(process.env.DB_URL);

async function refreshMisc() {
    const milestones = (await octo.request('GET /repos/nanocurrency/nano-node/milestones')).data;
    const open = milestones.filter(m => m.state == 'open').sort((a,b) => (new Date(b.created_at) - new Date(a.created_at)));
    const latest = open.filter(m => m.title.toLowerCase().startsWith('v'));

    const normalized = new Misc({
        protocol_milestone: {
            title: latest[0]?.title || open[0]?.title || 'inactive',
            open_issues: latest[0]?.open_issues || open[0]?.open_issues || 0,
            closed_issues: latest[0]?.closed_issues || open[0]?.closed_issues || 0
        }
    });
    await models.Misc.collection.drop();
    await models.Misc.create(normalized);
}

async function refreshRepos() {
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

    const uniqueRepos = queries.map(q => q.repos).flat().filter(function ({ full_name }) {
        return !this.has(full_name) && this.add(full_name);
    }, new Set);

    const normalized = uniqueRepos.map(({ id, name, full_name, html_url,created_at, stargazers_count }) => new Repo({ id, name, full_name, html_url,created_at, stargazers_count }));
    await models.Repo.collection.drop();
    await models.Repo.create(normalized);
    return normalized;
}

async function refreshCommitsAndContributors(repos = []) {
    let allCommits = [];

    for (let i = 0; i < repos.length; i++) {
        let foundAll = false, page = 1;
        while (!foundAll) {
            let activity = (await octo.request(`GET /repos/${repos[i].full_name}/commits`, { per_page: 100, page: page, since: '2014-05-01T14:49:25Z' })).data;
            activity = activity.map(act => ({...act, repo_full_name: repos[i].full_name}));
            allCommits = [...allCommits, ...activity];

            foundAll = activity.length < 100;
            if (!foundAll) page++;
        }
    }

    const contributors = {};

    allCommits.forEach((commit) =>{
        if (commit.author && !contributors[commit.author.login]) {
            contributors[commit.author.login] = { 
                avatar_url: commit.author.avatar_url, 
                login: commit.author.login, 
                contributions: 0, 
                repos: []
            }
        }
        if (commit.author && contributors[commit.author.login]) {
            contributors[commit.author.login].contributions += 1, 
            contributors[commit.author.login].repos = [...contributors[commit.author.login].repos, commit.repo_full_name]
        }
    });

    const normalizedContribs = Object.values(contributors).map(({ avatar_url, login, contributions, repos }) => new Contributor({ avatar_url, login, contributions, repos: [...new Set(repos)] }));
    await models.Contributor.collection.drop();
    await models.Contributor.create(normalizedContribs);

    const normalizedCommits = allCommits.map((commit) => new Commit({ repo_full_name: commit.repo_full_name, author: commit.author?.login, date: commit.commit.author?.date }));
    await models.Commit.collection.drop();
    await models.Commit.create(normalizedCommits);
}

cron.schedule('05 */2 * * *', async () => {
    refreshMisc();
    const repos = await refreshRepos();
    refreshCommitsAndContributors(repos);
});