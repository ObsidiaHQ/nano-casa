const mongoose =     require('mongoose');

const Repo = mongoose.model('Repo', new mongoose.Schema({
    name:             String,
    full_name:        String,
    created_at:       String,
    stargazers_count: Number,
    avatar_url:       String,
    prs_30d:          Number,
    prs_7d:           Number,
    commits_30d:      Number,
    commits_7d:       Number
}));
const Commit = mongoose.model('Commit', new mongoose.Schema({
    repo_full_name:   String,
    author:           String, // commit.author.login
    date:             String  // commit.commit.author.date
}));
const Contributor = mongoose.model('Contributor', new mongoose.Schema({
    login:            String,
    avatar_url:       String,
    contributions:    Number,
    last_month:       Number,
    repos:            [String]
}));
const Milestone = mongoose.model('Milestone', new mongoose.Schema({
    title:         String,
    open_issues:   Number,
    closed_issues: Number
}, { timestamps: { createdAt: 'created_at', updatedAt: false } }));
const Profile = mongoose.model('Profile', new mongoose.Schema({
    name:              String,
    github:            String,
    twitter:           String,
    sponsor_link:      String,
    nano_account:      String,
    description:       String,
    tags:              [String]
}));

module.exports = { Repo, Commit, Contributor, Milestone, Profile };