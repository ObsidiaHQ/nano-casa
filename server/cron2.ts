import Cron from 'croner';
import { Octokit } from 'octokit';
import {
    Repo,
    Contributor,
    Milestone,
    Commit,
    PublicNode,
    NodeEvent,
    Misc,
    Donor,
    Profile, // Assuming Profile model exists and is needed for contributor profile creation/updates
} from './models';
import db from './db';
import REPOS from './repos.json';
import axios from 'axios';

// --- Configuration & Setup ---
const octo = new Octokit({ auth: Bun.env.GITHUB_TOKEN });
axios.defaults.headers.common['Accept-Encoding'] = 'gzip';

// --- State Management (using Misc table) ---
const CRON_STATE_KEY_PREFIX = 'cron_last_run_';

async function getLastRunTimestamp(jobName: string): Promise<string | null> {
    try {
        const result = db.query<{ value: string }, [string]>(
            'SELECT value FROM Misc WHERE key = ?'
        ).get(`${CRON_STATE_KEY_PREFIX}${jobName}`);
        return result ? JSON.parse(result.value) : null;
    } catch (error) {
        console.error(`Error getting last run timestamp for ${jobName}:`, error);
        return null; // Default to fetching all if state is corrupted or missing
    }
}

async function setLastRunTimestamp(jobName: string, timestamp: string): Promise<void> {
    try {
        Misc.update(`${CRON_STATE_KEY_PREFIX}${jobName}`, timestamp);
    } catch (error) {
        console.error(`Error setting last run timestamp for ${jobName}:`, error);
    }
}

// --- Helper Functions ---
function isEmpty(obj: any): boolean {
    if (!obj) return true;
    for (const x in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, x)) {
            return false;
        }
    }
    return true;
}

async function rate() {
    try {
        const limit = (await octo.request('GET /rate_limit')).data.resources.core;
        console.log('Rate Limit:', limit);
        return limit;
    } catch (error) {
        console.error('Error fetching rate limit:', error);
        return null;
    }
}

/**
 * Refreshes repository data, handling additions, updates, and deletions.
 * Updates PR counts incrementally based on recent activity.
 */
export async function refreshRepos() {
    const JOB_NAME = 'repos';
    console.time(`cron:${JOB_NAME}`);
    const lastRunTimestamp = await getLastRunTimestamp(JOB_NAME);
    const now = new Date();
    const nowISO = now.toISOString();

    try {
        // 1. Fetch Current Repos from GitHub
        console.time(`cron:${JOB_NAME}:fetch_github`);
        let fetchedReposData: any[] = [];
        for (const query of REPOS.queries) {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                try {
                    const res = await octo.request('GET /search/repositories', {
                        q: query,
                        per_page: 100,
                        page: page,
                    });
                    fetchedReposData.push(...res.data.items);
                    hasMore = res.data.items.length === 100;
                    page++;
                } catch (error) {
                    console.error(`Error fetching repo page ${page} for query "${query}":`, error);
                    hasMore = false; // Stop pagination on error for this query
                }
            }
        }

        const knownRepoRequests = REPOS.known.map(name =>
            octo.request(`GET /repos/${name}`).then(res => res.data).catch(err => {
                console.warn(`Failed to fetch known repo ${name}:`, err.status === 404 ? 'Not Found' : err.message);
                return null; // Handle not found or other errors
            })
        );
        const knownResults = (await Promise.all(knownRepoRequests)).filter(Boolean); // Filter out nulls from failed fetches
        fetchedReposData.push(...knownResults);

        // Deduplicate and filter ignored
        const uniqueFetchedRepos = new Map<string, any>();
        for (const repo of fetchedReposData) {
            if (repo && repo.full_name && !REPOS.ignored.includes(repo.full_name)) {
                uniqueFetchedRepos.set(repo.full_name, repo);
            }
        }
        console.timeEnd(`cron:${JOB_NAME}:fetch_github`);

        // 2. Get Current DB State
        const dbRepos = db.query<{ full_name: string }, []>('SELECT full_name FROM Repos').all();
        const dbRepoNames = new Set(dbRepos.map(r => r.full_name));
        const fetchedRepoNames = new Set(uniqueFetchedRepos.keys());

        // 3. Reconcile
        const reposToInsert: Partial<Repo>[] = [];
        const reposToUpdate: Partial<Repo>[] = [];
        const reposToDelete: string[] = [];

        // Identify new and existing/to-update
        for (const [fullName, repoData] of uniqueFetchedRepos.entries()) {
            const repoInfo: Partial<Repo> = {
                name: repoData.name,
                full_name: repoData.full_name,
                created_at: repoData.created_at,
                stargazers_count: repoData.stargazers_count,
                description: repoData.description,
                avatar_url: repoData.owner?.avatar_url,
                // prs_30d, prs_7d, commits_30d, commits_7d updated incrementally later
            };
            if (!dbRepoNames.has(fullName)) {
                reposToInsert.push(repoInfo);
            } else {
                // Mark for potential update (check if fields actually changed)
                // For simplicity, we'll update all existing ones for now.
                // A more optimized approach would fetch current DB data and compare.
                reposToUpdate.push(repoInfo);
            }
        }

        // Identify deleted
        for (const dbName of dbRepoNames) {
            if (!fetchedRepoNames.has(dbName)) {
                reposToDelete.push(dbName);
            }
        }

        // 4. Database Operations (within a transaction for safety)
        console.time(`cron:${JOB_NAME}:db_ops`);
        db.transaction(() => {
            // Inserts
            if (reposToInsert.length > 0) {
                const insertStmt = Repo.insert(); // Assuming Repo.insert() returns a reusable statement
                reposToInsert.forEach(repo => {
                    try {
                        insertStmt.run(
                            repo.name, repo.full_name, repo.created_at, repo.stargazers_count,
                            0, 0, // Initialize PR counts, will be updated
                            repo.description, repo.avatar_url
                        );
                    } catch (err) {
                        console.error(`Error inserting repo ${repo.full_name}:`, err);
                    }
                });
                console.log(`Inserted ${reposToInsert.length} repos`);
            }

            // Updates (basic info)
            if (reposToUpdate.length > 0) {
                const updateStmt = db.prepare(`
          UPDATE Repos
          SET name = ?, created_at = ?, stargazers_count = ?, description = ?, avatar_url = ?
          WHERE full_name = ?
        `);
                reposToUpdate.forEach(repo => {
                    try {
                        updateStmt.run(
                            repo.name, repo.created_at, repo.stargazers_count,
                            repo.description, repo.avatar_url, repo.full_name
                        );
                    } catch (err) {
                        console.error(`Error updating basic info for repo ${repo.full_name}:`, err);
                    }
                });
                console.log(`Updated ${reposToUpdate.length} repos`);
            }

            // Deletions (handle cascading deletes)
            if (reposToDelete.length > 0) {
                const deleteRepoStmt = db.prepare('DELETE FROM Repos WHERE full_name = ?');
                const deleteCommitsStmt = db.prepare('DELETE FROM Commits WHERE repo_full_name = ?');
                // TODO: Consider updating contributor repo lists if a repo is deleted.
                // This might require fetching contributor data, parsing JSON, updating, and re-saving.
                // For simplicity now, we only delete the repo and its commits.
                reposToDelete.forEach(fullName => {
                    try {
                        console.log(`Deleting repo: ${fullName} and associated commits`);
                        deleteCommitsStmt.run(fullName);
                        deleteRepoStmt.run(fullName);
                    } catch (err) {
                        console.error(`Error deleting repo ${fullName}:`, err);
                    }
                });
                console.log(`Deleted ${reposToDelete.length} repos`);
            }
        })(); // End transaction
        console.timeEnd(`cron:${JOB_NAME}:db_ops`);

        // 5. Update PR counts incrementally (for currently tracked repos)
        console.time(`cron:${JOB_NAME}:update_pr_counts`);
        const currentTrackedRepos = Repo.getAll(); // Get the list *after* reconciliation
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // --- Parallel PR Count Fetching ---
        const prCountPromises = currentTrackedRepos.map(async (repo) => {
            const counts = { _7d: 0, _30d: 0 };
            let page = 1;
            let morePrs = true;
            let foundPrsSinceLastRelevant = false;

            while (morePrs && !foundPrsSinceLastRelevant) {
                try {
                    const pulls = (await octo.request(`GET /repos/${repo.full_name}/pulls`, {
                        state: 'all',
                        per_page: 100,
                        page: page,
                    })).data;

                    if (pulls.length === 0) {
                        morePrs = false;
                        break;
                    }

                    for (const pr of pulls) {
                        const createdAt = new Date(pr.created_at);
                        if (createdAt >= new Date(thirtyDaysAgo)) {
                            counts._30d++;
                            if (createdAt >= new Date(sevenDaysAgo)) {
                                counts._7d++;
                            }
                        } else {
                            foundPrsSinceLastRelevant = true;
                            break;
                        }
                    }
                    morePrs = pulls.length === 100;
                    page++;
                } catch (error: any) {
                    if (error.status === 404) {
                        console.warn(`Repo ${repo.full_name} not found during PR count update (might be recently deleted).`);
                    } else {
                        console.error(`Error fetching PRs for ${repo.full_name} page ${page}:`, error.message);
                    }
                    morePrs = false; // Stop for this repo on error
                    // Return current counts even if an error occurred mid-fetch
                    return { fullName: repo.full_name, counts };
                }
            }
            return { fullName: repo.full_name, counts };
        });

        const prCountResults = await Promise.all(prCountPromises);
        // --- End Parallel PR Count Fetching ---

        // Update DB with PR counts
        const updatePrStmt = db.prepare('UPDATE Repos SET prs_30d = ?, prs_7d = ? WHERE full_name = ?');
        db.transaction(() => {
            for (const result of prCountResults) {
                if (result) { // Check if result is not null/undefined (in case of errors)
                    try {
                        updatePrStmt.run(result.counts._30d, result.counts._7d, result.fullName);
                    } catch (error) {
                        console.error(`Error updating PR counts for ${result.fullName}:`, error);
                    }
                }
            }
        })();
        console.timeEnd(`cron:${JOB_NAME}:update_pr_counts`);

        await setLastRunTimestamp(JOB_NAME, nowISO);

    } catch (error) {
        console.error(`Unhandled error in ${JOB_NAME}:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}

/**
 * Refreshes commits and contributor stats incrementally.
 * Assumes refreshRepos has run recently to have an up-to-date repo list.
 */
export async function refreshCommitsAndContributors() {
    const JOB_NAME = 'commits_contributors';
    console.time(`cron:${JOB_NAME}`);
    const lastRunTimestamp = await getLastRunTimestamp(JOB_NAME);
    const now = new Date();
    const nowISO = now.toISOString();

    try {
        const repos = Repo.getAll(); // Get currently tracked repos
        if (repos.length === 0) {
            console.warn(`No repos found in DB for ${JOB_NAME}, skipping.`);
            return;
        }

        console.time(`cron:${JOB_NAME}:fetch_commits`);
        const newCommits: any[] = []; // Store commits fetched across all repos
        const repoCommitFetchErrors: string[] = [];

        // --- Parallel Commit Fetching ---
        const commitFetchPromises = repos.map(async (repo) => {
            const repoCommits: any[] = [];
            let page = 1;
            let moreCommits = true;
            let foundCommitOlderThanLastRun = false;

            while (moreCommits && !foundCommitOlderThanLastRun) {
                try {
                    const commitsData = (await octo.request(`GET /repos/${repo.full_name}/commits`, {
                        per_page: 100,
                        page: page,
                        since: lastRunTimestamp ?? undefined,
                    })).data;

                    if (commitsData.length === 0) {
                        moreCommits = false;
                        break;
                    }

                    for (const commit of commitsData) {
                        if (isEmpty(commit.author) || !commit.commit?.author?.date) {
                            continue;
                        }
                        if (lastRunTimestamp && new Date(commit.commit.author.date) <= new Date(lastRunTimestamp)) {
                            foundCommitOlderThanLastRun = true;
                            continue;
                        }
                        repoCommits.push({
                            ...commit,
                            repo_full_name: repo.full_name,
                            avatar_url: repo.avatar_url,
                            author_login: commit.author.login,
                            author_avatar: commit.author.avatar_url,
                            commit_date: commit.commit.author.date,
                            commit_message: commit.commit.message,
                            sha: commit.sha
                        });
                    }
                    moreCommits = commitsData.length === 100;
                    page++;
                } catch (error: any) {
                    if (error.status === 404 || error.status === 409) {
                        console.warn(`Repo ${repo.full_name} not found or empty during commit fetch.`);
                    } else {
                        console.error(`Error fetching commits for ${repo.full_name} page ${page}:`, error.message);
                        repoCommitFetchErrors.push(repo.full_name); // Log repo with error
                    }
                    moreCommits = false; // Stop fetching for this repo on error
                    // Return whatever commits were fetched before the error
                    return repoCommits;
                }
            }
            return repoCommits;
        });

        const fetchedCommitsArrays = await Promise.all(commitFetchPromises);
        fetchedCommitsArrays.forEach(repoCommits => {
            if (repoCommits && repoCommits.length > 0) {
                newCommits.push(...repoCommits);
            }
        });
        // --- End Parallel Commit Fetching ---

        console.timeEnd(`cron:${JOB_NAME}:fetch_commits`);
        if (repoCommitFetchErrors.length > 0) {
            console.warn(`Commit fetch errors occurred for repos: ${repoCommitFetchErrors.join(', ')}`);
        }

        if (newCommits.length === 0) {
            console.log(`No new commits found since ${lastRunTimestamp || 'the beginning'}.`);
            await setLastRunTimestamp(JOB_NAME, nowISO); // Update timestamp even if no new commits
            console.timeEnd(`cron:${JOB_NAME}`);
            return;
        }

        console.log(`Found ${newCommits.length} new commits to process.`);

        // Process New Commits and Update Contributors/Repo Stats
        console.time(`cron:${JOB_NAME}:db_ops`);
        const uniqueNewCommits = new Map<string, any>();
        newCommits.forEach(c => uniqueNewCommits.set(c.sha, c)); // Simple SHA-based deduplication

        const contributorsToUpdate: { [login: string]: { newCommits: number, newRepos: Set<string>, avatar_url: string, last_month_increase: number } } = {};
        const repoCommitCounts: { [fullName: string]: { _7d: number, _30d: number } } = {};

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        db.transaction(() => {
            const insertCommitStmt = Commit.insert(); // Assume returns reusable statement
            const getContribStmt = db.prepare<
                { login: string; contributions: number; last_month: number; repos: string },
                [string]
            >('SELECT login, contributions, last_month, repos FROM Contributors WHERE login = ?');
            const insertContribStmt = db.prepare( // Simplified insert/update logic
                `INSERT INTO Contributors (login, avatar_url, contributions, last_month, repos) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(login) DO UPDATE SET
                contributions = contributions + excluded.contributions,
                last_month = last_month + excluded.last_month,
                repos = CASE WHEN INSTR(repos, excluded.repos) = 0 THEN json_insert(repos, '$[#]', excluded.repos) ELSE repos END,
                avatar_url = excluded.avatar_url` // Update avatar if needed
            );
            // Also ensure Profile exists
            const insertProfileStmt = db.prepare(
                `INSERT OR IGNORE INTO Profiles (login, avatar_url) VALUES (?, ?)`
            );

            for (const commit of uniqueNewCommits.values()) {
                try {
                    // Insert commit
                    insertCommitStmt.run(
                        commit.repo_full_name,
                        commit.author_login,
                        commit.commit_date,
                        commit.commit_message,
                        commit.author_avatar || commit.avatar_url // Prefer author's avatar
                    );

                    // Prepare contributor update
                    const login = commit.author_login;
                    const commitDate = new Date(commit.commit_date);

                    if (!contributorsToUpdate[login]) {
                        contributorsToUpdate[login] = {
                            newCommits: 0,
                            newRepos: new Set(),
                            avatar_url: commit.author_avatar || commit.avatar_url,
                            last_month_increase: 0,
                        };
                    }
                    contributorsToUpdate[login].newCommits++;
                    contributorsToUpdate[login].newRepos.add(commit.repo_full_name);
                    if (commitDate >= thirtyDaysAgo) {
                        contributorsToUpdate[login].last_month_increase++;
                    }

                    // Prepare repo commit count update
                    if (!repoCommitCounts[commit.repo_full_name]) {
                        repoCommitCounts[commit.repo_full_name] = { _7d: 0, _30d: 0 };
                    }
                    if (commitDate >= thirtyDaysAgo) {
                        repoCommitCounts[commit.repo_full_name]._30d++;
                        if (commitDate >= sevenDaysAgo) {
                            repoCommitCounts[commit.repo_full_name]._7d++;
                        }
                    }

                } catch (error: any) {
                    // Check for unique constraint violation (commit already processed?)
                    if (error.message?.includes('UNIQUE constraint failed: Commits')) {
                        console.warn(`Commit SHA ${commit.sha} likely already exists, skipping.`);
                    } else {
                        console.error(`Error processing commit ${commit.sha} for repo ${commit.repo_full_name}:`, error);
                    }
                }
            }

            // Apply contributor updates
            for (const login in contributorsToUpdate) {
                const updateData = contributorsToUpdate[login];
                try {
                    // Ensure profile exists first
                    insertProfileStmt.run(login, updateData.avatar_url);

                    // Get current contributor state to handle repo list merge correctly
                    const currentContrib = getContribStmt.get(login);
                    let currentRepos: string[] = [];
                    if (currentContrib && currentContrib.repos) {
                        try {
                            currentRepos = JSON.parse(currentContrib.repos);
                        } catch (e) { console.error(`Failed to parse existing repos JSON for ${login}: ${currentContrib.repos}`); }
                    }

                    const updatedReposSet = new Set([...currentRepos, ...updateData.newRepos]);
                    const updatedReposJson = JSON.stringify([...updatedReposSet]);

                    // Use a more robust INSERT/UPDATE for Contributors
                    db.prepare(
                        `INSERT INTO Contributors (login, avatar_url, contributions, last_month, repos)
                     VALUES ($login, $avatar_url, $contributions, $last_month, $repos)
                     ON CONFLICT(login) DO UPDATE SET
                        contributions = contributions + $contributions,
                        last_month = last_month + $last_month,
                        repos = $repos,
                        avatar_url = $avatar_url` // Keep avatar updated
                    ).run({
                        $login: login,
                        $avatar_url: updateData.avatar_url,
                        $contributions: updateData.newCommits,
                        $last_month: updateData.last_month_increase,
                        $repos: updatedReposJson
                    });


                } catch (error) {
                    console.error(`Error updating contributor ${login}:`, error);
                }
            }

            // Apply repo commit count updates
            const updateRepoCommitStmt = db.prepare(
                'UPDATE Repos SET commits_30d = commits_30d + ?, commits_7d = commits_7d + ? WHERE full_name = ?'
            );
            for (const fullName in repoCommitCounts) {
                try {
                    updateRepoCommitStmt.run(
                        repoCommitCounts[fullName]._30d,
                        repoCommitCounts[fullName]._7d,
                        fullName
                    );
                } catch (error) {
                    console.error(`Error updating commit counts for repo ${fullName}:`, error);
                }
            }

        })(); // End transaction
        console.timeEnd(`cron:${JOB_NAME}:db_ops`);

        await setLastRunTimestamp(JOB_NAME, nowISO);

    } catch (error) {
        console.error(`Unhandled error in ${JOB_NAME}:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}


/**
 * Refreshes milestones, handling open, closed, and potentially deleted ones.
 */
export async function refreshMilestones() {
    const JOB_NAME = 'milestones';
    console.time(`cron:${JOB_NAME}`);

    try {
        // 1. Fetch Milestones from GitHub
        console.time(`cron:${JOB_NAME}:fetch_github`);
        let milestones: any[] = [];
        try {
            milestones = (
                await octo.request('GET /repos/nanocurrency/nano-node/milestones', {
                    state: 'all', // Fetch all states initially to handle potential deletions/closings if needed later
                    per_page: 100 // Assume < 100 milestones for now
                })
            ).data;
            console.log(`Fetched ${milestones.length} milestones from GitHub.`);
        } catch (error) {
            console.error(`Error fetching milestones from GitHub:`, error);
            // Decide if we should continue or re-throw/return
            // For now, we'll stop the job here if fetching fails.
            throw error; // Re-throw to be caught by the outer catch
        } finally {
            console.timeEnd(`cron:${JOB_NAME}:fetch_github`);
        }


        // 2. Process Milestones
        // Filter for open, 'v' prefixed milestones and format them
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
            .sort((a, b) => b.title.localeCompare(a.title)); // Keep sorting by title

        console.log(`Processed ${latest.length} relevant open milestones.`);

        // 3. Database Operations (Delete + Insert)
        console.time(`cron:${JOB_NAME}:db_ops`);
        try {
            const insertMilestones = db.transaction((arr: typeof latest) => {
                db.prepare('DELETE FROM Milestones').run();
                const insertStmt = Milestone.insert();
                for (const ms of arr) {
                    try {
                        insertStmt.run(
                            ms.title,
                            ms.open_issues,
                            ms.closed_issues,
                            ms.url,
                            ms.number
                        );
                    } catch (dbInsertError) {
                        console.error(`Error inserting milestone "${ms.title}" (Number: ${ms.number}):`, dbInsertError);
                        // Continue trying to insert other milestones
                    }
                }
            });

            insertMilestones(latest);
            console.log(`Successfully updated milestones in the database.`);
        } catch (dbError) {
            console.error(`Error during milestone database transaction:`, dbError);
            // Transaction likely rolled back automatically, but log the error.
        } finally {
            console.timeEnd(`cron:${JOB_NAME}:db_ops`);
        }

    } catch (error) {
        console.error(`Unhandled error in ${JOB_NAME}:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}


/**
 * Refreshes node events incrementally.
 */
export async function refreshNodeEvents() {
    const JOB_NAME = 'node_events';
    console.time(`cron:${JOB_NAME}`);
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
                    action: `pushed ${item.payload.commits.length} commit${item.payload.commits.length > 1 ? 's' : ''
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

    try {

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
        return events;
    } catch (error) {
        console.error(`Unhandled error in ${JOB_NAME}:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}

export async function checkPublicNodes() {
    const JOB_NAME = 'public_nodes';
    console.time(`cron:${JOB_NAME}`);
    const endpointStatuses = [];

    // --- Parallel Node Checking ---
    const nodeCheckPromises = REPOS.public_nodes.map(async (node) => {
        let start = Date.now();
        try {
            const res = await axios.post(
                node.endpoint,
                { action: 'version' },
                { timeout: 2500, validateStatus: (status) => status < 500 }
            );
            let resp_time = Date.now() - start;
            return {
                endpoint: node.endpoint,
                website: node.website,
                websocket: node.websocket,
                up: res.status >= 200 && res.status < 300 && res.data?.node_vendor,
                resp_time,
                version: res.data?.node_vendor || '?',
                error: null,
            };
        } catch (error: any) {
            let resp_time = Date.now() - start;
            let errorMsg = 'Unknown Error';
            let isUp = false;

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    errorMsg = 'Timeout';
                } else if (error.response) {
                    errorMsg = `Status ${error.response.status}`;
                    isUp = (error.response.status || 0) < 500;
                    if (error.response.data?.error) {
                        errorMsg += `: ${error.response.data.error}`;
                    }
                } else if (error.request) {
                    errorMsg = 'No response';
                } else {
                    errorMsg = error.message;
                }
            } else {
                errorMsg = error.message || 'Non-Axios error';
            }
            console.warn(`Public node check failed for ${node.endpoint}: ${errorMsg}`);
            return {
                endpoint: node.endpoint,
                website: node.website,
                websocket: node.websocket,
                up: isUp,
                resp_time,
                version: null,
                error: { error: errorMsg },
            };
        }
    });

    const results = await Promise.all(nodeCheckPromises);
    endpointStatuses.push(...results.filter(Boolean)); // Add results (filter out potential nulls if error handling changed)

    try {
        console.time(`cron:${JOB_NAME}:db_ops`);
        const insertNodes = db.transaction((arr: typeof endpointStatuses) => {
            db.prepare('DELETE FROM PublicNodes').run(); // Simple delete+insert for this small dataset
            const insertStmt = PublicNode.insert();
            for (const node of arr)
                insertStmt.run(
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
        console.timeEnd(`cron:${JOB_NAME}:db_ops`);
    } catch (dbError) {
        console.error(`Error updating PublicNodes in DB:`, dbError);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}

export async function getDevFundHistory() {
    const JOB_NAME = 'dev_fund';
    console.time(`cron:${JOB_NAME}`);
    try {
        console.time(`cron:${JOB_NAME}:fetch_nano_to`);
        const knownPromise = axios.get('https://nano.to/known.json');
        const historyPromise = axios.post('https://rpc.nano.to', {
            action: 'account_history',
            account: '@Protocol_fund',
            count: '-1',
            reverse: true, // Oldest first
            key: Bun.env.NANO_RPC_KEY,
        }, { timeout: 10000 }); // Increased timeout


        const [knownRes, historyRes] = await Promise.all([knownPromise, historyPromise]);
        console.timeEnd(`cron:${JOB_NAME}:fetch_nano_to`);

        const knownMap = new Map<string, any>(knownRes.data.map((obj: any) => [obj.name, obj]));
        const history = historyRes.data?.history;

        if (!history || !Array.isArray(history)) {
            console.error('Invalid history response:', historyRes.data);
            return;
        }
        if (history.length === 0) {
            console.warn('Dev fund history response was empty.');
            return;
        }

        console.time(`cron:${JOB_NAME}:process_data`);
        const balances = new Array(history.length);
        const labels = new Array(history.length);
        const donorsMap: { [account: string]: Partial<Donor> & { amount_nano: number } } = {};
        const txSign = (type: string) => (type === 'send' ? -1 : 1);

        let runningBalance = 0; // Start from 0, first entry sets the initial balance change

        history.forEach((tx: any, i: number) => {
            const amountNano = parseFloat(tx.amount_nano || '0');
            const timestamp = parseInt(tx.local_timestamp || '0') * 1000;

            labels[i] = timestamp ? new Date(timestamp).toISOString().split('T')[0] : 'Unknown Date'; // Use ISO Date

            // Calculate running balance correctly
            runningBalance += amountNano * txSign(tx.type);
            balances[i] = Math.round(runningBalance);


            if (tx.type !== 'send' && tx.account && amountNano > 0) {
                const username = tx.username || knownMap.get(tx.account)?.name || null; // Check map if username missing
                if (!donorsMap[tx.account]) {
                    donorsMap[tx.account] = {
                        account: tx.account,
                        amount_nano: 0,
                        username: username,
                    };
                }
                donorsMap[tx.account].amount_nano += amountNano;
                // Update username if found later in history or via knownMap
                if (username && !donorsMap[tx.account].username) {
                    donorsMap[tx.account].username = username;
                }
            }
        });

        const donors: Donor[] = Object.values(donorsMap)
            .filter(donor => donor.amount_nano > 0) // Ensure positive donation
            .map((donor) => {
                const knownObj = donor.username ? knownMap.get(donor.username) : null;
                return {
                    ...donor,
                    amount_nano: donor.amount_nano, // Ensure amount_nano is present
                    account: donor.account!, // Assert account is present
                    // Add details from knownMap if available
                    twitter: knownObj?.twitter || null,
                    github: knownObj?.github || null,
                    website: knownObj?.website || null,
                };
            })
            .sort((a, b) => b.amount_nano - a.amount_nano);
        console.timeEnd(`cron:${JOB_NAME}:process_data`);

        console.time(`cron:${JOB_NAME}:db_ops`);
        Misc.update('devFundData', balances);
        Misc.update('devFundLabels', labels);
        Misc.update('devFundDonors', donors);
        console.timeEnd(`cron:${JOB_NAME}:db_ops`);

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            console.error(`Axios Error fetching dev fund history or known.json: ${error.message}`, error.response?.data);
        } else {
            console.error(`Error processing dev fund history:`, error);
        }
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}

export async function updateSpotlight() {
    const JOB_NAME = 'spotlight';
    console.time(`cron:${JOB_NAME}`);
    try {
        const repos = Repo.getAll()
            .filter(r => r.stargazers_count < 500 && r.description); // Example: Filter less popular repos with descriptions

        if (repos.length === 0) {
            console.warn('No suitable repos found for spotlight.');
            return;
        }

        // Weighted random selection (optional, simple random for now)
        // Could weight towards repos with recent activity or lower star counts
        const randomIndex = Math.floor(Math.random() * repos.length);
        const spotlightRepo = repos[randomIndex];

        Misc.update('spotlight', spotlightRepo);
        console.log(`Updated spotlight repo to: ${spotlightRepo.full_name}`);

    } catch (error) {
        console.error(`Error updating spotlight:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}

// --- Cron Job Logging Wrapper ---
const MAX_JOB_RUNS_TO_KEEP = 50; // Keep logs for the last N runs per job

async function runCronJobWithLogging(jobName: string, jobFunction: () => Promise<void>) {
    const originalConsoleLog = console.log; // Keep a reference to the original console.log
    originalConsoleLog(`Starting cron job: ${jobName}...`);
    const startTime = new Date();
    const startISO = startTime.toISOString();
    const activeTimers = new Map<string, number>(); // Store start times for timers

    let jobRunId: number | bigint | null = null;
    let status: 'running' | 'success' | 'failure' = 'running'; // Start with running status

    // 1. Create the initial job run entry
    try {
        const startStmt = db.prepare(`
            INSERT INTO CronJobRuns (job_name, start_timestamp, status)
            VALUES (?, ?, ?)
        `);
        const info = startStmt.run(jobName, startISO, status);
        jobRunId = info.lastInsertRowid;
    } catch (dbError) {
        console.error(`!!! Failed to create initial CronJobRuns entry for ${jobName}:`, dbError);
        // If we can't even log the start, we probably shouldn't run the job or override console
        return; // Exit early
    }

    // Prepare statement for inserting logs
    const insertLogStmt = db.prepare(`
        INSERT INTO Logs (job_run_id, timestamp, level, message, duration_ms)
        VALUES (?, ?, ?, ?, ?)
    `);

    // Function to insert log entries
    const insertLog = (level: string, message: string, duration?: number) => {
        if (!jobRunId) return; // Should not happen if initial insert succeeded
        try {
            const timestamp = new Date().toISOString();
            insertLogStmt.run(jobRunId, timestamp, level, message, duration ?? null);
        } catch (dbError) {
            console.error(`!!! Failed to insert Logs entry for job run ${jobRunId}:`, dbError);
            // Log to original console as fallback
            console.error(`[${level.toUpperCase()}] ${message}`); // Removed label/duration from fallback
        }
    };

    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        time: console.time,
        timeEnd: console.timeEnd,
    };

    // Override console functions
    console.log = (...args: any[]) => {
        const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
        insertLog('log', message);
    };
    console.warn = (...args: any[]) => {
        const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
        insertLog('warn', message);
    };
    console.error = (...args: any[]) => {
        const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ');
        // Check if the last argument looks like an error with a stack
        const lastArg = args[args.length - 1];
        const stack = (lastArg instanceof Error && lastArg.stack) ? `\nStack: ${lastArg.stack}` : '';
        insertLog('error', message + stack);
    };

    console.time = (label: string = 'default') => {
        if (activeTimers.has(label)) {
            const message = `Timer '${label}' started again without end.`;
            insertLog('warn', message);
            originalConsole.warn(message);
        }
        activeTimers.set(label, Date.now());
    };

    console.timeEnd = (label: string = 'default') => {
        const endTime = Date.now();
        const startTime = activeTimers.get(label);

        if (startTime) {
            const duration = endTime - startTime;
            insertLog('timeEnd', `Timer '${label}' ended.`, duration);
            activeTimers.delete(label);
        } else {
            const message = `Timer '${label}' ended without start.`;
            insertLog('warn', message);
            originalConsole.warn(message);
        }
    };

    // --- Execute the actual job ---
    try {
        await jobFunction();
        status = 'success';
        originalConsoleLog(`Finished cron job: ${jobName} successfully.`);
    } catch (error: any) {
        status = 'failure';
        const errorMessage = `Cron job ${jobName} failed: ${error?.message || error}`;
        const stack = error?.stack ? `\nStack: ${error.stack}` : '';
        // Log the error to the database
        insertLog('error', errorMessage + stack);
        // Also log error via original console
        originalConsole.error(errorMessage, error?.stack);
    } finally {
        // --- Finalize Job Run ---
        const endTime = new Date();
        const endISO = endTime.toISOString();
        const durationMs = endTime.getTime() - startTime.getTime();

        // Clear any remaining timers (log warnings for them)
        if (activeTimers.size > 0) {
            for (const [label, timerStartTime] of activeTimers.entries()) {
                const unfinishedDuration = endTime.getTime() - timerStartTime;
                insertLog('warn', `Timer '${label}' was left active at job end. (duration: ${unfinishedDuration}ms)`, unfinishedDuration);
            }
            activeTimers.clear();
        }

        // Update the CronJobRuns entry
        if (jobRunId) {
            try {
                const updateStmt = db.prepare(`
                    UPDATE CronJobRuns
                    SET end_timestamp = ?, status = ?, duration_ms = ?
                    WHERE id = ?
                `);
                updateStmt.run(endISO, status, durationMs, jobRunId);
            } catch (dbError) {
                console.error(`!!! Failed to update final status for CronJobRuns entry ${jobRunId}:`, dbError);
            }

            // --- Pruning Logic ---
            try {
                // Find the ID of the Nth most recent run for this job name
                const findNthRunIdStmt = db.prepare<{ id: number }, [string, number]>(`
                     SELECT id FROM CronJobRuns
                     WHERE job_name = ?
                     ORDER BY start_timestamp DESC
                     LIMIT 1 OFFSET ?
                 `);
                const nthRun = findNthRunIdStmt.get(jobName, MAX_JOB_RUNS_TO_KEEP - 1); // OFFSET is 0-based

                if (nthRun) {
                    // Delete runs older than the Nth run (logs are deleted by CASCADE)
                    const pruneStmt = db.prepare(`
                         DELETE FROM CronJobRuns
                         WHERE job_name = ? AND id < ?
                     `);
                    const pruneInfo = pruneStmt.run(jobName, nthRun.id);
                    if (pruneInfo.changes > 0) {
                        originalConsoleLog(`Pruned ${pruneInfo.changes} old job runs (and their logs) for job ${jobName}.`);
                    }
                }
            } catch (dbError) {
                console.error(`!!! Failed to prune old logs for job ${jobName}:`, dbError);
            }
        } else {
            console.error("!!! Cannot update/prune job run, jobRunId is null.");
        }

        // Restore original console functions
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.time = originalConsole.time;
        console.timeEnd = originalConsole.timeEnd;
    }
}

// --- Cron Job Scheduling ---
// Function to prune old logs
async function pruneOldLogs() {
    const JOB_NAME = 'prune_logs';
    console.time(`cron:${JOB_NAME}`);
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1); // Get yesterday's date
        yesterday.setUTCHours(0, 0, 0, 0); // Set time to 00:00:00 UTC

        const cutoffTimestamp = yesterday.toISOString();
        console.log(`Pruning logs older than ${cutoffTimestamp}...`);

        const pruneStmt = db.prepare(`
            DELETE FROM Logs
            WHERE timestamp < ?
        `);
        const info = pruneStmt.run(cutoffTimestamp);
        console.log(`Pruned ${info.changes} old log entries.`);

    } catch (error) {
        console.error(`Error pruning old logs:`, error);
    } finally {
        console.timeEnd(`cron:${JOB_NAME}`);
    }
}


// Main data refresh (Repos, Commits, Contributors, Milestones) - Run less frequently? e.g., every hour
// const mainJob = new Cron('0 * * * *', { name: 'main_refresh', timezone: 'UTC', unref: true }, async (cron: Cron) => {
//   await runCronJobWithLogging('main_refresh', async () => {
//     await rate();
//     await refreshRepos();
//     await refreshCommitsAndContributors();
//     await refreshMilestones();
//   });
// });

// // Frequent updates (Node Events, Public Nodes) - Run more often, e.g., every 15 minutes
// const frequentJob = new Cron('*/15 * * * *', { name: 'frequent_updates', timezone: 'UTC', unref: true }, async (cron: Cron) => {
//     await runCronJobWithLogging('frequent_updates', async () => {
//         await refreshNodeEvents();
//         await checkPublicNodes();
//     });
// });

// // Less frequent updates (Dev Fund, Spotlight) - Run daily
// const dailyJob = new Cron('0 4 * * *', { name: 'daily_updates', timezone: 'UTC', unref: true }, async (cron: Cron) => {
//     await runCronJobWithLogging('daily_updates', async () => {
//         await getDevFundHistory();
//         await updateSpotlight();
//     });
// });

// // Daily log pruning job - Run at midnight UTC
// const pruneJob = new Cron('0 0 * * *', { name: 'prune_logs', timezone: 'UTC', unref: true }, async (cron: Cron) => {
//     await runCronJobWithLogging('prune_logs', pruneOldLogs);
// });

// Optional: Run initial fetch on startup?
(async () => {
    console.log("Running initial data fetch on startup...");
    await runCronJobWithLogging('initial_fetch', async () => {
        await rate();
        await refreshRepos();
        await refreshCommitsAndContributors();
        await refreshMilestones();
        await refreshNodeEvents();
        await checkPublicNodes();
        await getDevFundHistory();
        await updateSpotlight();
    });
    console.log("Initial data fetch complete.");
})(); 