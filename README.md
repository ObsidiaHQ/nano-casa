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

You can [suggest a repo to be included](https://github.com/obsidiaHQ/nano-casa/issues/1), a new feature or report a bug in [issues](https://github.com/obsidiaHQ/nano-casa/issues). PRs are also welcome, but please reach out first before starting to work on something.

## Local build

Rename `.env.sample` to `.env` and fill with your variables.

Run `bun install`.

Start the dashboard with `bun run start` and the server/cronjob with `bun run server:dev` and `bun run server:cron`.

Tech stack is Angular/Hono+Bun/SQLite.

todo:
finish login and profile editing
update profile realtime on FE
migrate profiles
sync repos.json
update angular
test
