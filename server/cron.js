const Cron = require('croner');
const { Octokit } = require('octokit');
require('dotenv').config();
const models = require('./models');
const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPOS = require('./repos.json');
const createClient = require('redis').createClient;
const redis = createClient({
    // host: 'localhost',
    // port: process.env.REDIS_PORT || 6379,
    // password: process.env.REDIS_PASS,
    url: process.env.REDIS_URL,
});

redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect();

async function rate() {
    console.log((await octo.request('GET /rate_limit')).data.resources.core);
}

async function refreshMilestones() {
    console.time('refreshed_milestones');
    const milestones = (
        await octo.request('GET /repos/nanocurrency/nano-node/milestones')
    ).data;
    const latest = milestones
        .filter(
            (m) => m.state == 'open' && m.title.toLowerCase().startsWith('v')
        )
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const normalized = latest
        .map(
            ({ title, open_issues, closed_issues, html_url, number }) =>
                new models.Milestone({
                    title,
                    open_issues,
                    closed_issues,
                    url: html_url,
                    number,
                })
        )
        .sort((a, b) => b.title.localeCompare(a.title));
    await models.Milestone.collection.drop();
    await models.Milestone.insertMany(normalized, { lean: true });

    console.timeEnd('refreshed_milestones');
}

async function refreshRepos() {
    console.time('fetched_repos');
    const lastMonth = new Date(new Date().setDate(new Date().getDate() - 30));
    const lastWeek = new Date(new Date().setDate(new Date().getDate() - 7));
    let allRepos = [];

    for (let i = 0; i < REPOS.queries.length; i++) {
        let foundAll = false,
            page = 1;
        while (!foundAll) {
            const res = (
                await octo.request('GET /search/repositories', {
                    q: REPOS.queries[i],
                    per_page: 100,
                    page: page,
                })
            ).data.items;
            allRepos = [...allRepos, ...res];

            foundAll = res.length < 100;
            if (!foundAll) page++;
        }
    }

    const repoRequests = REPOS.known.map((name) =>
        octo.request(`GET /repos/${name}`).then((res) => res.data)
    );
    const knownResults = await Promise.all(repoRequests);

    allRepos = [...allRepos, ...knownResults];

    const uniqueRepos = allRepos.filter(function ({ full_name }) {
        return (
            !this.has(full_name) &&
            this.add(full_name) &&
            !REPOS.ignored.includes(full_name)
        );
    }, new Set());

    console.timeEnd('fetched_repos');
    console.time('fetched_pulls');

    for (let i = 0; i < uniqueRepos.length; i++) {
        let foundAll = false,
            page = 1;
        uniqueRepos[i].prs_30d = 0;
        uniqueRepos[i].prs_7d = 0;
        while (!foundAll) {
            let pulls = (
                await octo.request(
                    `GET /repos/${uniqueRepos[i].full_name}/pulls`,
                    { per_page: 100, page: page }
                )
            ).data;
            pulls = pulls.filter((pr) => new Date(pr.created_at) > lastMonth);
            uniqueRepos[i].prs_30d += pulls.length;
            uniqueRepos[i].prs_7d += pulls.filter(
                (pr) => new Date(pr.created_at) > lastWeek
            ).length;

            foundAll = pulls.length < 100;
            if (!foundAll) page++;
        }
    }
    console.timeEnd('fetched_pulls');

    console.time('refreshed_repos');

    const normalized = uniqueRepos.map(
        ({
            id,
            name,
            full_name,
            html_url,
            created_at,
            pushed_at,
            stargazers_count,
            owner,
            prs_30d,
            prs_7d,
            description,
        }) =>
            new models.Repo({
                id,
                name,
                full_name,
                html_url,
                created_at,
                pushed_at,
                stargazers_count,
                avatar_url: owner.avatar_url,
                prs_30d,
                prs_7d,
                description,
            })
    );
    await models.Repo.collection.drop();
    await models.Repo.collection.insertMany(normalized, { lean: true });

    console.timeEnd('refreshed_repos');

    return normalized;
}

async function refreshCommitsAndContributors(repos = []) {
    let allCommits = [];
    console.time('fetched_commits');
    const lastMonth = new Date(new Date().setDate(new Date().getDate() - 30));
    const lastWeek = new Date(new Date().setDate(new Date().getDate() - 7));

    for (let i = 0; i < repos.length; i++) {
        let foundAll = false,
            page = 1;

        while (!foundAll) {
            let activity = (
                await octo.request(`GET /repos/${repos[i].full_name}/commits`, {
                    per_page: 100,
                    page: page,
                    since: '2014-05-01T14:49:25Z',
                })
            ).data;
            activity = activity.map((act) => ({
                ...act,
                repo_full_name: repos[i].full_name,
                avatar_url: repos[i].avatar_url,
            }));
            allCommits = [...allCommits, ...activity];

            foundAll = activity.length < 100;
            if (!foundAll) page++;
        }
    }
    console.timeEnd('fetched_commits');

    const contributors = {};
    const reposToUpdate = {};
    const bulk = models.Repo.collection.initializeUnorderedBulkOp();

    const seen = new Set();
    allCommits = allCommits.filter((commit) => {
        const duplicateSHA = seen.has(commit.sha);
        seen.add(commit.sha);
        return !isEmpty(commit.author) && !duplicateSHA;
    });

    for (let i = 0; i < allCommits.length; i++) {
        const commit = allCommits[i];
        if (!contributors[commit.author.login]) {
            contributors[commit.author.login] = {
                avatar_url: commit.author.avatar_url,
                login: commit.author.login,
                contributions: 0,
                last_month: 0,
                repos: [],
            };
        }
        contributors[commit.author.login].contributions += 1;
        contributors[commit.author.login].repos = [
            ...contributors[commit.author.login].repos,
            commit.repo_full_name,
        ];

        if (new Date(commit.commit.author?.date) > lastMonth) {
            contributors[commit.author.login].last_month += 1;
            reposToUpdate[commit.repo_full_name] = reposToUpdate[
                commit.repo_full_name
            ] ?? { _30d: 0, _7d: 0 };
            reposToUpdate[commit.repo_full_name]._30d += 1;
            if (new Date(commit.commit.author?.date) > lastWeek)
                reposToUpdate[commit.repo_full_name]._7d += 1;
        }
    }

    Object.keys(reposToUpdate).forEach((name) => {
        bulk.find({ full_name: name }).updateOne([
            {
                $set: {
                    commits_30d: reposToUpdate[name]._30d,
                    commits_7d: reposToUpdate[name]._7d,
                },
            },
        ]);
    });

    if (bulk.length) bulk.execute();

    console.time('refreshed_commits');

    const normalizedContribs = Object.values(contributors).map(
        ({ avatar_url, login, contributions, repos, last_month }) =>
            new models.Contributor({
                avatar_url,
                login,
                contributions,
                last_month,
                repos: [...new Set(repos)],
            })
    );
    await models.Contributor.collection.drop();
    await models.Contributor.collection.insertMany(normalizedContribs, {
        lean: true,
    });

    const normalizedCommits = allCommits.map(
        (commit) =>
            new models.Commit({
                repo_full_name: commit.repo_full_name,
                author: commit.author.login,
                date: commit.commit.author?.date,
                avatar_url: commit.avatar_url,
                message: commit.commit.message,
            })
    );
    await models.Commit.collection.drop();
    await models.Commit.collection.insertMany(normalizedCommits, {
        lean: true,
    });

    console.timeEnd('refreshed_commits');
}

function isEmpty(obj) {
    for (var x in obj) {
        return false;
    }
    return true;
}

// returns a random index weighted inversely
async function getSpotlight() {
    const repos = (await redis.json.get('data', { path: '$.repos' }))[0]
        .slice(15)
        .filter((r) => r.description);
    return repos[Math.floor(Math.random() * repos.length)];
}

async function refreshNodeEvents() {
    // Copyright (c) 2021 nano.community contributors
    const formatEvent = (item) => {
        switch (item.type) {
            case 'CommitCommentEvent':
                return {
                    action: 'commented commit', // created
                    ref: item.payload.comment.commit_id,
                    event_url: item.payload.comment.html_url,
                    body: item.payload.comment.body,
                };

            case 'IssueCommentEvent':
                return {
                    action: 'commented issue', // created, edited, deleted
                    ref: item.payload.issue.number,
                    event_url: item.payload.comment.html_url,
                    title: item.payload.issue.title,
                    body: item.payload.comment.body,
                };

            case 'IssuesEvent':
                return {
                    action: `${item.payload.action} issue`, // opened, closed, reopened, assigned, unassigned, labeled, unlabled
                    ref: item.payload.issue.number,
                    event_url: item.payload.issue.html_url,
                    title: item.payload.issue.title,
                };

            case 'PullRequestEvent':
                return {
                    action: `${item.payload.action.replace('_', ' ')} pr`, // opened, closed, reopened, assigned, unassigned, review_requested, review_request_removed, labeled, unlabeled, and synchronize
                    ref: item.payload.pull_request.number,
                    title: item.payload.pull_request.title,
                    event_url: item.payload.pull_request.html_url,
                    body: item.payload.pull_request.body,
                };

            case 'PullRequestReviewEvent':
                return {
                    action: `${item.payload.review.state.replace('_', ' ')} pr`, // created
                    ref: item.payload.pull_request.number,
                    title: `#${item.payload.pull_request.number}`,
                    body: item.payload.review.body,
                    event_url: item.payload.review.html_url,
                };

            case 'PullRequestReviewCommentEvent':
                return {
                    action: 'commented pr review',
                    ref: item.payload.pull_request.number,
                    event_url: item.payload.comment.html_url,
                    title: item.payload.pull_request.title,
                    body: item.payload.comment.body,
                };

            case 'PushEvent':
                return {
                    action: `pushed ${item.payload.commits.length} commit${
                        item.payload.commits.length > 1 ? 's' : ''
                    } to ${item.payload.ref.slice(
                        item.payload.ref.lastIndexOf('/') + 1
                    )}`,
                    event_url: item.payload.commits[0].url
                        .replace('api.', '')
                        .replace('/repos', ''),
                    title: item.payload.commits[0].message,
                };

            case 'ReleaseEvent':
                return {
                    action: 'published release',
                    ref: item.payload.release.tag_name,
                    title: item.payload.release.name,
                    body: item.payload.release.body,
                    event_url: item.payload.release.html_url,
                };

            default:
                return {};
        }
    };

    const EVENT_TYPES = [
        'PullRequestEvent',
        'IssueCommentEvent',
        'IssuesEvent',
        'CommitCommentEvent',
        'PushEvent',
        'ReleaseEvent',
        'PullRequestReviewEvent',
        'PullRequestReviewCommentEvent',
    ];
    console.time('refreshed_node_events');

    let events = (
        await octo.request(`GET /repos/nanocurrency/nano-node/events`, {
            per_page: 70,
        })
    ).data
        .filter((eve) => EVENT_TYPES.includes(eve.type))
        .map(
            (eve) =>
                new models.NodeEvent({
                    event: formatEvent(eve),
                    type: eve.type,
                    author: eve.actor.login,
                    avatar_url: eve.actor.avatar_url,
                    created_at: eve.created_at,
                })
        );

    await models.NodeEvent.collection.drop();
    const res = await models.NodeEvent.collection.insertMany(events, {
        lean: true,
    });
    console.timeEnd('refreshed_node_events');
    return res.acknowledged ? events : [];
}

const job = new Cron('10 * * * *', async () => {
    await refreshMilestones();
    const repos = await refreshRepos();
    await refreshCommitsAndContributors(repos);
    await redis.json.set('data', '.', await models.queryDB());
});

const eventsJob = new Cron('13 * * * *', async () => {
    await redis.json.set('data', '$.nodeEvents', await refreshNodeEvents());
});

const spotlightJob = new Cron('0 0 * * *', async () => {
    await redis.json.set('data', '$.spotlight', await getSpotlight());
});

module.exports = {
    refreshCommitsAndContributors,
    refreshMilestones,
    refreshRepos,
    rate,
    refreshNodeEvents,
    getSpotlight,
};
