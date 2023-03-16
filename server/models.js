const mongoose = require('mongoose');
mongoose.connect(process.env.DB_URL);

const Repo = mongoose.model(
    'Repo',
    new mongoose.Schema({
        name: String,
        full_name: String,
        created_at: String,
        pushed_at: String,
        stargazers_count: Number,
        avatar_url: String,
        prs_30d: Number,
        prs_7d: Number,
        commits_30d: Number,
        commits_7d: Number,
        description: String,
    })
);
const Commit = mongoose.model(
    'Commit',
    new mongoose.Schema({
        repo_full_name: String,
        author: String, // commit.author.login
        date: String, // commit.commit.author.date
        message: String,
        avatar_url: String,
    })
);
const Milestone = mongoose.model(
    'Milestone',
    new mongoose.Schema(
        {
            title: String,
            open_issues: Number,
            closed_issues: Number,
            url: String,
            number: Number,
        },
        { timestamps: { createdAt: 'created_at', updatedAt: false } }
    )
);

const Profile = mongoose.model(
    'Profile',
    new mongoose.Schema(
        {
            _id: String, // login
            avatar_url: String,
            bio: String,
            twitter_username: String,
            website: String,
            nano_address: String,
            gh_sponsors: Boolean,
            patreon_url: String,
        },
        { timestamps: { createdAt: 'created_at', updatedAt: false } }
    )
);

const Contributor = mongoose.model(
    'Contributor',
    new mongoose.Schema({
        login: String,
        avatar_url: String,
        contributions: Number,
        last_month: Number,
        repos: [String],
    })
);

const NodeEvent = mongoose.model(
    'NodeEvent',
    new mongoose.Schema({
        event: Object,
        type: String,
        author: String,
        avatar_url: String,
        created_at: String,
    })
);

module.exports = { Repo, Commit, Contributor, Milestone, Profile, NodeEvent };
