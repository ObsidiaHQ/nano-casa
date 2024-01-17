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
            goal: {
                type: {
                    title: String,
                    amount: Number,
                    nano_address: String,
                    website: String,
                    description: String,
                },
                default: {},
            },
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

const PublicNode = mongoose.model(
    'PublicNode',
    new mongoose.Schema({
        endpoint: String,
        website: String,
        websocket: String,
        up: Boolean,
        resp_time: Number,
        version: String,
        error: Object,
        deprecated: Boolean,
    })
);

const Misc = mongoose.model(
    'Misc',
    new mongoose.Schema({
        spotlight: Object,
        devFundLabels: [String],
        devFundData: [Number],
    })
);

async function countActiveDevs(windowInDays) {
    const now = new Date();
    // Calculate the date that was windowInDays days ago
    const windowStart = new Date(
        now.getTime() - windowInDays * 24 * 60 * 60 * 1000
    );
    return (
        await Commit.aggregate([
            {
                $project: {
                    date: {
                        $dateFromString: {
                            dateString: '$date',
                            format: '%Y-%m-%dT%H:%M:%SZ',
                        },
                    },
                    author: 1,
                },
            },
            {
                $match: { date: { $gte: windowStart } },
            },
            {
                $group: { _id: '$author' },
            },
            {
                $count: 'total',
            },
        ])
    )[0].total;
}

async function queryDB() {
    const data = {
        publicNodes: await PublicNode.find({}, { _id: 0 })
            .sort({ endpoint: 'asc' })
            .lean(),
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
        misc: await Misc.findOne({}, { _id: 0 }).lean(),
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
    PublicNode,
    Misc,
    queryDB,
};
