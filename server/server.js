const express = require('express');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const helmet = require('helmet');
const cors = require('cors');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
require('dotenv').config();
const models = require('./models');
const app = express();

// Redis
const createClient = require('redis').createClient;
const redis = createClient({
    host: 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS,
    //url: process.env.REDIS_URL,
});
redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect();

// Passportjs
passport.use(
    new GitHubStrategy(
        {
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: 'https://nano.casa/auth/github/callback',
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
    max: 300, // Limit each IP to 500 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Misc
const BUILD_PATH = './nano-casa';
const EXPLORER_PATH = './html';
app.use(express.static(path.join(__dirname, BUILD_PATH)));
app.use(express.static(path.join(__dirname, EXPLORER_PATH)));
app.use(compression());
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                'default-src': ["'self'", 'net.mamar.dev'],
                'script-src': ["'self'", 'goal.nano.to', 'net.mamar.dev'],
            },
        },
    })
);
app.use(
    cors({
        origin: ['https://nano.casa', 'https://nano.org'],
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Router
app.get('/data', async (req, res) => {
    let cached = await redis.json.get('data', '$');
    if (cached) {
        res.json(cached);
    } else {
        await redis.json.set('data', '$', await models.queryDB());
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
        goal = {},
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
            goal,
        },
        { new: true }
    )
        .then(async (usr) => {
            updateProfilesCache(usr);
            res.status(201).send(usr);
        })
        .catch(() => res.status(500).send());
});

app.get('/ping', async (req, res) => {
    res.status(200).send();
});

app.get('/explorer', async (req, res) => {
    res.removeHeader('Content-Security-Policy');
    res.sendFile(path.resolve(__dirname, EXPLORER_PATH, 'index.html'));
});

app.get('/*', (req, res) => {
    res.sendFile(path.resolve(__dirname, BUILD_PATH, 'index.html'));
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
