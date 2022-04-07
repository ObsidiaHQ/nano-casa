const express =      require('express');
const cors =         require('cors');
const compression =  require('compression');
const cron =         require('node-cron');
const path =         require('path');
const { Octokit } =  require('octokit');
const mongoose =     require('mongoose');
const rateLimit =    require('express-rate-limit');
require('dotenv').config();
const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });
mongoose.connect(process.env.DB_URL);

const Repo = mongoose.model('Repo', new mongoose.Schema({
    name:             String,
    full_name:        String,
    created_at:       String,
    stargazers_count: Number
}));
const Commit = mongoose.model('Commit', new mongoose.Schema({
    repo_full_name:   String,
    author:           String, // commit.author.login
    date:             String  // commit.commit.author.date
}));
const Contributor = mongoose.model('Contributor', new mongoose.Schema({
    login:            String,
    avatar_url:       String,
    contributions:    Number,
    repos_involved:   Number
}));
const Misc = mongoose.model('Misc', new mongoose.Schema({
    protocol_milestone: {
        title:         String,
        open_issues:   Number,
        closed_issues: Number
    }
}));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const app = express();
app.use(cors());
app.use(compression());
app.use(limiter);

const build_path = './nano-casa';
app.use(express.static(path.join(__dirname, build_path)));

app.all('/', function (req, res) {
    res.sendFile(path.resolve(__dirname, build_path, 'index.html'));
});

app.all('/data', async function (req, res) {
    const data = {
        repos: await Repo.find({}, { _id: 0 }).sort({ created_at: 'asc' }),
        contributors: await Contributor.find({}, { _id: 0 }).sort({ contributions: 'desc', repos_involved: 'desc' }),
        commits: await Commit.aggregate([{
            $group: {
                _id: {
                    year: {
                        $year: {
                            $dateFromString: { dateString: "$date", format: "%Y-%m-%dT%H:%M:%SZ" }
                        }
                    },
                    week: {
                        $week: {
                            $dateFromString: { dateString: "$date", format: "%Y-%m-%dT%H:%M:%SZ" }
                        }
                    }
                },
                count : { $sum : 1 }
            }
        }, {
            $sort: {
              '_id.year': 1,
              '_id.week': 1
            }
        }]),
        misc: await Misc.findOne({ _id: { '$ne': null }}, { _id: 0 })
    };
    res.json(data);
});

app.listen(8080, function() {
    console.log("server running at http://localhost:8080");
});

cron.schedule('15 */2 * * *', async () => {
    await refreshRepos();
    refreshMisc();
    refreshContributors();
    refreshCommits();
});

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
    await Misc.collection.drop();
    await Misc.create(normalized);
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
    await Repo.collection.drop();
    await Repo.create(normalized);
}

async function refreshCommits() {
    let all = [];
    const repos = await Repo.find();

    for (let i = 0; i < repos.length; i++) {
        let foundAll = false, page = 1;
        while (!foundAll) {
            let activity = (await octo.request(`GET /repos/${repos[i].full_name}/commits`, { per_page: 100, page: page })).data;
            activity = activity.map(act => ({...act, repo_full_name: repos[i].full_name}));
            all = [...all, ...activity];

            foundAll = activity.length < 100;
            if (!foundAll) page++;
        }
    }

    const normalized = all.map((commit) => new Commit({ repo_full_name: commit.repo_full_name, author: commit.author?.login, date: commit.commit.author?.date }));
    await Commit.collection.drop();
    await Commit.create(normalized);
}

async function refreshContributors() {
    let all = [];
    const repos = await Repo.find();

    for (let i = 0; i < repos.length; i++) {
        let foundAll = false, page = 1;
        while (!foundAll) {
            const repoContributors = (await octo.request(`GET /repos/${repos[i].full_name}/contributors`, { per_page: 100, page: page })).data;
            all = [...all, ...repoContributors];

            foundAll = repoContributors.length < 100;
            if (!foundAll) page++;
        }
    }

    const unique = all.filter(function ({ login }) {
        return !this.has(login) && this.add(login);
    }, new Set);

    const normalized = unique.map(({ login, avatar_url, html_url }) => new Contributor(
        { 
            login, 
            avatar_url, 
            html_url, 
            contributions: all.filter(c => c.login === login).reduce((total, usr) => total + usr.contributions, 0),
            repos_involved: all.filter(c => c.login === login).length
        }
    ));
    await Contributor.collection.drop();
    await Contributor.create(normalized);
}
