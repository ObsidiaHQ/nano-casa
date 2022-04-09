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
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const app = express();
app.use(cors());
app.use(compression());
app.use(limiter);

const build_path = './nano-casa';
app.use(express.static(path.join(__dirname, build_path)));

app.all('/', function (req, res) {
    res.sendFile(path.resolve(__dirname, build_path, 'index.html'));
});

app.all('/data', async function (req, res) {
    const data = {
        repos: await models.Repo.find({}, { _id: 0 }).sort({ created_at: 'asc' }),
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
            $project: { date: { $concat: [{ $toString: '$_id.year' }, '|', { $toString: '$_id.week' }] }, count: 1, _id: 0 } 
        }, {
            $sort: { date: 1 }
        }]),
        misc: await models.Misc.findOne({ _id: { '$ne': null }}, { _id: 0 })
    };
    res.json(data);
});

app.listen(8080, function() {
    console.log("server running at http://localhost:8080");
});
