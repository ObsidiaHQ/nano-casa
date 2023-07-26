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
        commits_30d: { type: Number, default: 0 },
        commits_7d: { type: Number, default: 0 },
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
            goals: [
                {
                    title: String,
                    amount: Number,
                    nano_address: String,
                    website: String,
                    description: String,
                    created_at: { type: Date, default: Date.now },
                },
            ],
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

async function queryDB() {
    const data = {
        nodeEvents: await NodeEvent.find({}, { _id: 0 })
            .sort({ created_at: 'desc' })
            .lean(),
        repos: await Repo.find({}, { _id: 0 })
            .sort({ created_at: 'asc' })
            .lean(),
        contributors: await Contributor.aggregate([
            {
                $project: {
                    contributions: 1,
                    last_month: 1,
                    repos_count: { $size: '$repos' },
                    repos: 1,
                    login: 1,
                    avatar_url: 1,
                    _id: 0,
                },
            },
            {
                $lookup: {
                    from: 'profiles',
                    localField: 'login',
                    foreignField: '_id',
                    as: 'profile',
                },
            },
            {
                // return first profile
                $set: {
                    profile: { $arrayElemAt: ['$profile', 0] },
                },
            },
            { $sort: { contributions: -1, repos_count: -1 } },
        ]),
        commits: await Commit.aggregate([
            {
                $group: {
                    _id: {
                        year: {
                            $year: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%Y-%m-%dT%H:%M:%SZ',
                                },
                            },
                        },
                        week: {
                            $week: {
                                $dateFromString: {
                                    dateString: '$date',
                                    format: '%Y-%m-%dT%H:%M:%SZ',
                                },
                            },
                        },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { '_id.year': 1, '_id.week': 1 },
            },
            {
                $project: {
                    date: {
                        $concat: [
                            { $toString: '$_id.year' },
                            '|',
                            { $toString: '$_id.week' },
                        ],
                    },
                    count: 1,
                    _id: 0,
                },
            },
        ]),
        milestones: await Milestone.find({}, { _id: 0 }).lean(),
        events: await Commit.find(
            { repo_full_name: { $ne: 'nanocurrency/nano-node' } },
            { _id: 0 }
        )
            .sort({ date: 'desc' })
            .limit(40)
            .lean(),
    };
    return data;
}

module.exports = {
    Repo,
    Commit,
    Contributor,
    Milestone,
    Profile,
    NodeEvent,
    queryDB,
};
