const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { rate, queryDB } = require('./cron');
const createClient = require('redis').createClient;
require('dotenv').config();
const redis = createClient({
    url: process.env.REDIS_URL,
});

redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect();

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // Limit each IP to 1000 requests per `window` (here, per 10 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const app = express();
app.use(cors());
app.use(compression());
app.use(limiter);

const build_path = './nano-casa';
const explorer_path = './html';
app.use(express.static(path.join(__dirname, build_path)));
app.use(express.static(path.join(__dirname, explorer_path)));

app.get('/data', async function (req, res) {
    let cached = await redis.json.get('data', '.');
    if (cached) {
        res.json(cached);
    } else {
        await redis.json.set('data', '.', await queryDB());
        res.json(await redis.json.get('data', '.'));
    }
});

app.get('/explorer', async function (req, res) {
    res.sendFile(path.resolve(__dirname, explorer_path, 'index.html'));
});

app.get('/ping', async function (req, res) {
    rate();
    res.status(200).send('pong');
});

app.get('/', function (req, res) {
    res.sendFile(path.resolve(__dirname, build_path, 'index.html'));
});

app.listen(8080, function () {
    console.log('server running at http://localhost:8080');
});
