const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
require('dotenv').config();
const models = require('./models');
const app = express();

// Redis
const createClient = require('redis').createClient;
const redis = createClient({
    // host: 'localhost',
    // port: process.env.REDIS_PORT || 6379,
    // password: process.env.REDIS_PASS,
    url: process.env.REDIS_URL,
});
redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect();

// Passportjs
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: 'http://localhost:8080/auth/github/callback',
        },
        function (accessToken, refreshToken, profile, done) {
            const { login, avatar_url, bio, twitter_username, blog } =
                profile._json;
            models.Profile.findByIdAndUpdate(
                login,
                {
                    _id: login,
                    avatar_url,
                    bio,
                    twitter_username,
                    website: blog,
                },
                { upsert: true, new: true }
            )
                .then(async (user) => {
                    updateProfilesCache(user);
                    return done(null, user);
                })
                .catch((err) => done(err, null));
        }
    )
);
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.session());
app.use(passport.initialize());

// Rate limiter
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 500, // Limit each IP to 500 requests per `window` (here, per 10 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Misc
const build_path = './nano-casa';
const explorer_path = './html';
app.use(express.static(path.join(__dirname, build_path)));
app.use(express.static(path.join(__dirname, explorer_path)));
app.use(compression());
//app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Router
app.get('/data', async (req, res) => {
    let cached = await redis.json.get('data', '$');
    if (false) {
        res.json(cached);
    } else {
        await redis.json.set('data', '$', await queryDB());
        res.json(await redis.json.get('data', '$'));
    }
});

app.get(
    '/auth/github',
    passport.authenticate('github', { scope: [] }),
    () => {}
);

app.get(
    '/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/auth/user', async (req, res) => {
    if (req.isAuthenticated()) {
        res.status(200).send(await models.Profile.findById(req.user._id));
    } else {
        res.status(401).send();
    }
});

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.status(200).send();
    });
});

app.post('/set-profile', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).send();
    }
    const {
        bio,
        twitter_username,
        website,
        nano_address,
        gh_sponsors,
        patreon_url,
    } = req.body;
    models.Profile.findByIdAndUpdate(
        req.user._id,
        {
            bio,
            twitter_username,
            website,
            nano_address,
            gh_sponsors,
            patreon_url,
        },
        { new: true }
    )
        .then(async (usr) => {
            updateProfilesCache(usr);
            res.status(201).send(usr);
        })
        .catch(() => res.status(500).send());
});

app.post('/add-goal', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).send();
    }
    models.Profile.findByIdAndUpdate(
        req.user._id,
        {
            $push: {
                goals: req.body,
            },
        },
        { new: true, useFindAndModify: false }
    )
        .then(async (usr) => {
            console.log(usr);
            //updateProfilesCache(usr);
            res.status(201).send(usr);
        })
        .catch(() => res.status(500).send());
});

app.get('/ping', async (req, res) => {
    res.status(200).send();
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, build_path, 'index.html'));
});

app.get('/explorer', async (req, res) => {
    res.sendFile(path.resolve(__dirname, explorer_path, 'index.html'));
});

app.listen(8080, () => {
    console.log('server running at http://localhost:8080');
});

async function updateProfilesCache(updatedProfile) {
    const path = `$.contributors[?(@.login == '${updatedProfile._id}')]`;
    let user = (await redis.json.get('data', { path: [path] }))[0];
    if (user) {
        user.profile = updatedProfile;
        redis.json.set('data', path, user);
    }
}

async function countActiveDevs(windowInDays) {
    const now = new Date();
    // Calculate the date that was windowInDays days ago
    const windowStart = new Date(
        now.getTime() - windowInDays * 24 * 60 * 60 * 1000
    );
    return (
        await models.Commit.aggregate([
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
        nodeEvents: await models.NodeEvent.find({}, { _id: 0 })
            .sort({ created_at: 'desc' })
            .lean(),
        repos: await models.Repo.find({}, { _id: 0 })
            .sort({ created_at: 'asc' })
            .lean(),
        contributors: await models.Contributor.aggregate([
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
        commits: await models.Commit.aggregate([
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
        milestones: await models.Milestone.find({}, { _id: 0 }).lean(),
        events: await models.Commit.find(
            { repo_full_name: { $ne: 'nanocurrency/nano-node' } },
            { _id: 0 }
        )
            .sort({ date: 'desc' })
            .limit(40)
            .lean(),
    };
    return data;
}

module.exports = { queryDB };
