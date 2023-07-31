![GitHub](https://img.shields.io/github/license/obsidiaHQ/nano-casa)

<img src="https://nano.casa/assets/logo.png" width="320">

Monitoring open source development in the [nano](https://nano.org/) ecosystem.

## Features

- [x] repos per year chart
- [x] list of all contributors
- [x] commits activity chart
- [x] highlights top contributors
- [x] developers profiles
- [x] active repos last week/month
- [x] events list

<img src="https://i.imgur.com/7NhvKim.png">

## Contribute

You can [suggest a repo to be included](https://github.com/obsidiaHQ/nano-casa/issues/1), a new feature or report a bug in [issues](https://github.com/obsidiaHQ/nano-casa/issues). PRs are welcome; just fork the repo and create a new branch for your work.

## Local build

Create a `server/.env` file with variables `GITHUB_TOKEN=your_token` and `DB_URL=mongodb_connection_string`.

Run `npm install` in both directories.

Start the dashboard with `ng serve` and the server/cronjob with `npm run start/cron`.
