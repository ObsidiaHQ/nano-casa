const mongoose = require("mongoose");
mongoose.connect(process.env.DB_URL);

const Repo = mongoose.model(
  "Repo",
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
  "Commit",
  new mongoose.Schema({
    repo_full_name: String,
    author: String, // commit.author.login
    date: String, // commit.commit.author.date
    message: String,
    avatar_url: String,
  })
);

const Milestone = mongoose.model(
  "Milestone",
  new mongoose.Schema(
    {
      title: String,
      open_issues: Number,
      closed_issues: Number,
      url: String,
      number: Number,
    },
    { timestamps: { createdAt: "created_at", updatedAt: false } }
  )
);

const Profile = mongoose.model(
  "Profile",
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
    { timestamps: { createdAt: "created_at", updatedAt: false } }
  )
);

const Contributor = mongoose.model(
  "Contributor",
  new mongoose.Schema({
    login: String,
    avatar_url: String,
    contributions: Number,
    last_month: Number,
    repos: [String],
  })
);

const NodeEvent = mongoose.model(
  "NodeEvent",
  new mongoose.Schema({
    event: Object,
    type: String,
    author: String,
    avatar_url: String,
    created_at: String,
  })
);

const PublicNode = mongoose.model(
  "PublicNode",
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
  "Misc",
  new mongoose.Schema({
    spotlight: Object,
    devFundLabels: [String],
    devFundData: [Number],
    devFundDonors: [Object],
  })
);

async function queryDB() {
  const data = {
    contributors: await Contributor.aggregate([
      {
        $project: {
          contributions: 1,
          last_month: 1,
          repos_count: { $size: "$repos" },
          repos: 1,
          login: 1,
          avatar_url: 1,
          _id: 0,
        },
      },
      {
        $lookup: {
          from: "profiles",
          localField: "login",
          foreignField: "_id",
          as: "profile",
        },
      },
      {
        // return first profile
        $set: {
          profile: { $arrayElemAt: ["$profile", 0] },
        },
      },
      { $sort: { contributions: -1, repos_count: -1 } },
    ]),
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
