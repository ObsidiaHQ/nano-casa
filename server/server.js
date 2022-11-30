const express =      require('express');
const cors =         require('cors');
const compression =  require('compression');
const path =         require('path');
const mongoose =     require('mongoose');
const rateLimit =    require('express-rate-limit');
const models =       require('./models');
require('dotenv').config();
mongoose.connect(process.env.DB_URL);

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
const explorer_path = './html'
app.use(express.static(path.join(__dirname, build_path)));
app.use(express.static(path.join(__dirname, explorer_path)));

app.get('/data', async function (req, res) {
    const data = {
        repos: await models.Repo.find({}, { _id: 0 }).sort({ created_at: 'asc' }).lean(),
        contributors: await models.Contributor.aggregate([
            { $project: { contributions: 1, last_month: 1, repos_count: { $size: "$repos" }, repos: 1, login: 1, avatar_url: 1, _id: 0 } },
            { $sort: { contributions: -1, repos_count: -1 } }
        ]),
        commits: await models.Commit.aggregate([{
            $group: {
                _id: {
                    year: {
                        $year: {
                            $dateFromString: { dateString: "$date", format: "%Y-%m-%dT%H:%M:%SZ" }
                        }
                    },
                    week: {
                        $week: {
                            $dateFromString: { dateString: "$date", format: "%Y-%m-%dT%H:%M:%SZ" }
                        }
                    }
                },
                count : { $sum : 1 }
            }
        }, {
            $sort: { '_id.year': 1, '_id.week': 1 }
        }, { 
            $project: { date: { $concat: [{ $toString: '$_id.year' }, '|', { $toString: '$_id.week' }] }, count: 1, _id: 0 } 
        }]),
        misc: await models.Misc.findOne({ _id: { '$ne': null }}, { _id: 0 }).lean(),
        devList: await models.Profile.find({}, { _id: 0 }).lean()
    };
    res.json(data);
});

app.get('/explorer', async function (req, res) {
    res.sendFile(path.resolve(__dirname, explorer_path, 'index.html'));
});

app.get('/ping', function (req, res) {
    res.status(200).send('pong');
});

app.get('/', function (req, res) {
    res.sendFile(path.resolve(__dirname, build_path, 'index.html'));
});

app.listen(8080, function() {
    console.log("server running at http://localhost:8080");
});
