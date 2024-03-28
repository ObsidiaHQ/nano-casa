import Cron from 'croner';
import { Octokit } from 'octokit';
import {
  IRepo,
  IContributor,
  IMilestone,
  ICommit,
  IProfile,
  IPublicNode,
  INodeEvent,
  IDonor,
} from './interfaces';
import {
  Repo,
  Contributor,
  Milestone,
  Commit,
  PublicNode,
  NodeEvent,
  Misc,
} from './models';
import db from './db';
const octo = new Octokit({ auth: process.env['GITHUB_TOKEN'] });
import REPOS from './repos.json';
import axios from 'axios';
axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

export async function rate() {
  console.log((await octo.request('GET /rate_limit')).data.resources.core);
}

export async function refreshMilestones() {
  console.time('refreshed_milestones');
  const milestones = (
    await octo.request('GET /repos/nanocurrency/nano-node/milestones')
  ).data;
  const latest = milestones
    .filter((m) => m.state == 'open' && m.title.toLowerCase().startsWith('v'))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map(({ title, open_issues, closed_issues, html_url, number }) => ({
      title,
      open_issues,
      closed_issues,
      url: html_url,
      number,
    }))
    .sort((a, b) => b.title.localeCompare(a.title));

  const insertMilestones = db.transaction((arr) => {
    db.prepare('DELETE FROM Milestones').run();
    for (const ms of arr)
      Milestone.insert().run(
        ms.title,
        ms.open_issues,
        ms.closed_issues,
        ms.url,
        ms.number
      );
  });

  insertMilestones(latest);
  console.timeEnd('refreshed_milestones');
}

export async function refreshRepos() {
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
        await octo.request(`GET /repos/${uniqueRepos[i].full_name}/pulls`, {
          per_page: 100,
          page: page,
        })
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
      name,
      full_name,
      html_url,
      created_at,
      stargazers_count,
      owner,
      prs_30d,
      prs_7d,
      description,
    }) => ({
      name,
      full_name,
      html_url,
      created_at,
      stargazers_count,
      avatar_url: owner.avatar_url,
      prs_30d,
      prs_7d,
      description,
    })
  );

  const insertRepos = db.transaction((arr) => {
    db.prepare('DELETE FROM Repos').run();
    for (const repo of arr)
      Repo.insert().run(
        repo.name,
        repo.full_name,
        repo.created_at,
        repo.stargazers_count,
        repo.prs_30d,
        repo.prs_7d,
        repo.description,
        repo.avatar_url
      );
  });

  insertRepos(normalized);
  console.timeEnd('refreshed_repos');

  return normalized;
}

export async function refreshCommitsAndContributors(repos = []) {
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

  const stmt = db.prepare(
    'UPDATE Repos SET commits_30d = ?, commits_7d = ? WHERE full_name = ?'
  );
  db.transaction(() => {
    Object.keys(reposToUpdate).forEach((name) => {
      stmt.run(reposToUpdate[name]._30d, reposToUpdate[name]._7d, name);
    });
  })();

  console.time('refreshed_commits');

  const normalizedContribs = Object.values(contributors).map(
    ({ avatar_url, login, contributions, repos, last_month }) => ({
      avatar_url,
      login,
      contributions,
      last_month,
      repos: [...new Set(repos)],
    })
  );

  const insertContributors = db.transaction((arr) => {
    db.prepare('DELETE FROM Contributors').run();
    for (const contrib of arr)
      Contributor.insert().run(
        contrib.avatar_url,
        contrib.login,
        contrib.contributions,
        contrib.last_month,
        JSON.stringify(contrib.repos)
      );
  });

  insertContributors(normalizedContribs);

  const normalizedCommits = allCommits.map((commit) => ({
    repo_full_name: commit.repo_full_name,
    author: commit.author.login,
    date: commit.commit.author?.date,
    avatar_url: commit.avatar_url,
    message: commit.commit.message,
  }));

  const insertCommits = db.transaction((arr) => {
    db.prepare('DELETE FROM Commits').run();
    for (const commit of arr)
      Commit.insert().run(
        commit.repo_full_name,
        commit.author,
        commit.date,
        commit.message,
        commit.avatar_url
      );
  });

  insertCommits(normalizedCommits);
  console.timeEnd('refreshed_commits');
}

function isEmpty(obj) {
  for (var x in obj) {
    return false;
  }
  return true;
}

// returns a random index weighted inversely
export async function updateSpotlight() {
  const repos = Repo.getAll()
    .slice(15) // ignore top repos
    .filter((r) => r.description);
  const sl = repos[Math.floor(Math.random() * repos.length)];
  Misc.update('spotlight', sl);
}

export async function refreshNodeEvents() {
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
          event_url: item.payload.commits[0]?.url
            .replace('api.', '')
            .replace('/repos', ''),
          title: item.payload.commits[0]?.message,
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
    .map((eve) => ({
      event: formatEvent(eve),
      type: eve.type,
      author: eve.actor.login,
      avatar_url: eve.actor.avatar_url,
      created_at: eve.created_at,
    }));

  const insertEvents = db.transaction((arr) => {
    db.prepare('DELETE FROM NodeEvents').run();
    for (const ev of arr)
      NodeEvent.insert().run(
        JSON.stringify(ev.event),
        ev.type,
        ev.author,
        ev.avatar_url,
        ev.created_at
      );
  });

  insertEvents(events);
  console.timeEnd('refreshed_node_events');
  return events;
}

export async function checkPublicNodes() {
  console.time('refreshed_public_nodes');
  const endpointStatuses = [];
  for (let node of REPOS.public_nodes) {
    let start = Date.now();
    try {
      const res = await axios.post(
        node.endpoint,
        { action: 'version' },
        { timeout: 2500 }
      );
      let resp_time = Date.now() - start;

      endpointStatuses.push({
        endpoint: node.endpoint,
        website: node.website,
        websocket: node.websocket,
        up: true,
        resp_time,
        version: res.data.node_vendor,
        error: null,
      });
    } catch (error) {
      let resp_time = Date.now() - start;
      console.log(error.response?.data);
      let errorMsg =
        error.code === 'ECONNABORTED'
          ? 'Timeout'
          : error.response?.data?.error ||
            `Failed with status code ${error.response?.status}`;
      endpointStatuses.push({
        endpoint: node.endpoint,
        website: node.website,
        websocket: node.websocket,
        up: (error.response?.status || 0) < 500,
        resp_time,
        error: { error: errorMsg },
      });
    }
  }

  const insertNodes = db.transaction((arr) => {
    db.prepare('DELETE FROM PublicNodes').run();
    for (const node of arr)
      PublicNode.insert().run(
        node.endpoint,
        node.website,
        node.websocket,
        node.up ? 1 : 0,
        node.resp_time,
        node.version,
        node.error ? JSON.stringify(node.error) : null
      );
  });

  insertNodes(endpointStatuses);
  console.timeEnd('refreshed_public_nodes');
}

export async function getDevFundHistory() {
  console.time('refreshed_dev_fund_history');
  const known = (await axios.get('https://nano.to/known.json')).data;
  const knownMap: Map<string, any> = new Map(
    known.map((obj) => [obj.name, obj])
  );

  axios
    .post('https://rpc.nano.to', {
      action: 'account_history',
      account: '@Protocol_fund',
      count: '-1',
      reverse: true,
      key: process.env['NANO_RPC_KEY'],
    })
    .then(async (res) => {
      const balances = new Array(res.data.history.length);
      const labels = new Array(res.data.history.length);
      const donorsMap = {};
      const txSign = (type) => (type === 'send' ? -1 : 1);
      res.data.history.forEach((tx, i) => {
        labels[i] = new Date(
          parseInt(tx.local_timestamp) * 1000
        ).toDateString();
        if (i === 0) {
          balances[i] = Math.round(parseFloat(tx.amount_nano));
        } else {
          balances[i] = Math.round(
            balances[i - 1] + parseFloat(tx.amount_nano) * txSign(tx.type)
          );
        }

        if (tx.type !== 'send') {
          if (tx.account in donorsMap) {
            donorsMap[tx.account].amount_nano += parseFloat(tx.amount_nano);
          } else {
            donorsMap[tx.account] = {
              account: tx.account,
              amount_nano: parseFloat(tx.amount_nano),
              username: tx.username || null,
            };
          }
        }
      });

      const donors = Object.values(donorsMap)
        .slice(1)
        .map((donor: IDonor) => {
          if (!donor.username) {
            return donor;
          }

          const knownObj = knownMap.get(donor.username);
          return {
            ...donor,
            twitter: knownObj.twitter || null,
            github: knownObj.github || null,
            website: knownObj.website || null,
          };
        })
        .sort((a, b) => b.amount_nano - a.amount_nano);

      Misc.update('devFundData', balances);
      Misc.update('devFundLabels', labels);
      Misc.update('devFundDonors', donors);
      console.timeEnd('refreshed_dev_fund_history');
    });
}

const job = new Cron('30 * * * *', async () => {
  refreshMilestones();
  getDevFundHistory();
  checkPublicNodes();
  const repos = await refreshRepos();
  refreshCommitsAndContributors(repos);
});

const eventsJob = new Cron('*/20 * * * *', async () => {
  refreshNodeEvents();
});

const spotlightJob = new Cron('0 0 * * *', async () => {
  updateSpotlight();
});
