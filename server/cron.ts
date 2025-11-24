import { Cron } from 'croner';
import { Octokit } from 'octokit';
import axios from 'axios';
import { eq, sql } from 'drizzle-orm';
import { Repo, Misc, Donor } from './models';
import db from './db';
import * as schema from './schema';
import REPOS from './repos.json';
axios.defaults.headers.common['Accept-Encoding'] = 'gzip';
const octo = new Octokit({ auth: Bun.env.GITHUB_TOKEN });

// Helper function to batch insert data to avoid SQLite variable limit (999)
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

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

  await db.transaction(async (tx) => {
    await tx.delete(schema.milestones);
    if (latest.length > 0) {
      const milestoneValues = latest.map((ms) => ({
        title: ms.title,
        openIssues: ms.open_issues,
        closedIssues: ms.closed_issues,
        url: ms.url,
        number: ms.number,
      }));

      // Batch inserts to avoid SQLite variable limit (999)
      const chunks = chunkArray(milestoneValues, 500);
      for (const chunk of chunks) {
        await tx.insert(schema.milestones).values(chunk);
      }
    }
  });
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
      createdAt: new Date(created_at),
      stargazers_count,
      avatar_url: owner.avatar_url,
      prs_30d,
      prs_7d,
      description,
    })
  );

  await db.transaction(async (tx) => {
    await tx.delete(schema.repos);
    if (normalized.length > 0) {
      const repoValues = normalized.map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        createdAt: repo.createdAt,
        stargazersCount: repo.stargazers_count,
        prs30d: repo.prs_30d,
        prs7d: repo.prs_7d,
        description: repo.description,
        avatarUrl: repo.avatar_url,
      }));

      // Batch inserts to avoid SQLite variable limit (999)
      const chunks = chunkArray(repoValues, 500);
      for (const chunk of chunks) {
        await tx.insert(schema.repos).values(chunk);
      }
    }
  });
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
        avatar_url: act?.author?.avatar_url || repos[i].avatar_url,
      }));
      allCommits = [...allCommits, ...activity];

      foundAll = activity.length < 100;
      if (!foundAll) page++;
    }
  }
  console.timeEnd('fetched_commits');

  const reposToUpdate = {};

  const seen = new Set();
  allCommits = allCommits.filter((commit) => {
    const duplicateSHA = seen.has(commit.sha);
    seen.add(commit.sha);
    return !isEmpty(commit.author) && !duplicateSHA;
  });

  for (let i = 0; i < allCommits.length; i++) {
    const commit = allCommits[i];

    if (new Date(commit.commit.author?.date) > lastMonth) {
      reposToUpdate[commit.repo_full_name] = reposToUpdate[
        commit.repo_full_name
      ] ?? { _30d: 0, _7d: 0 };
      reposToUpdate[commit.repo_full_name]._30d += 1;
      if (new Date(commit.commit.author?.date) > lastWeek)
        reposToUpdate[commit.repo_full_name]._7d += 1;
    }
  }

  await db.transaction(async (tx) => {
    for (const name of Object.keys(reposToUpdate)) {
      await tx
        .update(schema.repos)
        .set({
          commits30d: reposToUpdate[name]._30d,
          commits7d: reposToUpdate[name]._7d,
        })
        .where(eq(schema.repos.fullName, name));
    }
  });

  console.time('refreshed_commits');

  const normalizedCommits = allCommits.map((commit) => ({
    repo_full_name: commit.repo_full_name,
    author: commit.author.login,
    date: commit.commit.author?.date,
    avatar_url: commit.avatar_url,
    message: commit.commit.message,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(schema.commits);
    if (normalizedCommits.length > 0) {
      const commitValues = normalizedCommits.map((commit) => ({
        repoFullName: commit.repo_full_name,
        author: commit.author,
        date: commit.date,
        message: commit.message,
        avatarUrl: commit.avatar_url,
      }));

      // Batch inserts to avoid SQLite variable limit (999)
      // With 5 columns, we can safely insert ~150 rows per batch
      const chunks = chunkArray(commitValues, 500);
      for (const chunk of chunks) {
        await tx.insert(schema.commits).values(chunk);
      }
    }
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
export async function updateSpotlight() {
  const repos = (await Repo.getAll())
    .slice(15) // ignore top repos
    .filter((r) => r.description);
  const sl = repos[Math.floor(Math.random() * repos.length)];
  await Misc.update('spotlight', sl);
}

export async function refreshNodeEvents() {
  // Copyright (c) 2021 nano.community contributors
  const formatEvent = (item) => {
    //console.log(item);
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
          title: item.payload.pull_request.number,
          event_url: item.payload.pull_request.url,
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
        //console.log(item.payload);
        return {
          action: `pushed 1 commit to ${item.payload.ref.slice(item.payload.ref.lastIndexOf('/') + 1)}`,
          event_url: `https://github.com/nanocurrency/nano-node/commit/${item.payload.head}`,
          title: null,
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
      created_at: new Date(eve.created_at),
    }));

  await db.transaction(async (tx) => {
    await tx.delete(schema.nodeEvents);
    if (events.length > 0) {
      const eventValues = events.map((ev) => ({
        event: JSON.stringify(ev.event),
        type: ev.type,
        author: ev.author,
        avatarUrl: ev.avatar_url,
        createdAt: new Date(ev.created_at),
      }));

      // Batch inserts to avoid SQLite variable limit (999)
      const chunks = chunkArray(eventValues, 500);
      for (const chunk of chunks) {
        await tx.insert(schema.nodeEvents).values(chunk);
      }
    }
  });
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

  await db.transaction(async (tx) => {
    await tx.delete(schema.publicNodes);
    if (endpointStatuses.length > 0) {
      const nodeValues = endpointStatuses.map((node) => ({
        endpoint: node.endpoint,
        website: node.website,
        websocket: node.websocket,
        up: node.up ? 1 : 0,
        respTime: node.resp_time,
        version: node.version || null,
        error: node.error ? JSON.stringify(node.error) : null,
      }));

      // Batch inserts to avoid SQLite variable limit (999)
      const chunks = chunkArray(nodeValues, 500);
      for (const chunk of chunks) {
        await tx.insert(schema.publicNodes).values(chunk);
      }
    }
  });
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
      key: Bun.env.NANO_RPC_KEY,
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
        .map((donor: Donor) => {
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

const job = new Cron('16 * * * *', async () => {
  refreshMilestones();
  getDevFundHistory();
  checkPublicNodes();
  refreshNodeEvents();
  const repos = await refreshRepos();
  refreshCommitsAndContributors(repos);
  updateSpotlight();
});

const eventsJob = new Cron('*/30 * * * *', async () => {
  refreshNodeEvents();
});

const spotlightJob = new Cron('0 0 * * *', async () => {
  updateSpotlight();
});
