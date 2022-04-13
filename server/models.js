const mongoose =     require('mongoose');

const Repo = mongoose.model('Repo', new mongoose.Schema({
    name:             String,
    full_name:        String,
    created_at:       String,
    stargazers_count: Number
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
    last_month:        Number,
    repos:            [String]
}));
const Misc = mongoose.model('Misc', new mongoose.Schema({
    protocol_milestone: {
        title:         String,
        open_issues:   Number,
        closed_issues: Number
    },
    last_updated: Date
}));
const Profile = mongoose.model('Profile', new mongoose.Schema({
    name:              String,
    github:            String,
    twitter:           String,
    sponsor_link:      String,
    nano_account:      String,
    description:       String,
    tags:              [String]
}));

module.exports = { Repo, Commit, Contributor, Misc, Profile };