import { Component, OnInit } from '@angular/core';
import { faCodeBranch, faHistory, faStar, faUsers } from '@fortawesome/free-solid-svg-icons';
import { Octokit } from 'octokit';
import { ScaleType } from '@swimlane/ngx-charts';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    octokit = new Octokit();
    ScaleType = ScaleType;
    faRepo = faCodeBranch;
    faUser = faUsers;
    faStar = faStar;
    faHistory = faHistory;

    reposData = [];
    popularRepos = [];
    uniqueRepos = [];
    contributors = [];

    async ngOnInit() {
        await this.getRepos();
        this.getContributors();
    }

    async getRepos() {
        // list years since 2014
        const YEARS = Array.from(Array(new Date().getFullYear() - 2013), (_, i) => (i + 2014).toString());
        const YEARS_DICT = {};
        for (const year of YEARS) { YEARS_DICT[year] = { 'name': year, 'value': 0 } }
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const queries = [
            {
                topic: 'topic:nanocurrency',
                repos: []
            }, {
                topic: 'topic:cryptocurrency+topic:nano',
                repos: []
            }, {
                topic: 'topic:nano-currency',
                repos: []
            }, {
                topic: 'topic:nano-cryptocurrency',
                repos: []
            }, {
                topic: 'topic:crypto+topic:nano',
                repos: []
            }
        ];

        for (let i = 0; i < queries.length; i++) {
            queries[i].repos = (await this.octokit.request('GET /search/repositories', { q: queries[i].topic, per_page: 100 })).data.items;
            // TODO: handle responses with > 100 results
        }

        // const activity = (await this.octokit.request('GET /repos/nanocurrency/nano-node/commits', { per_page: 100, page: 2 })).data;
        // console.log(activity)
        //console.log(DateTime.fromISO('2020-06-24T09:22:17Z').toFormat('W'))

        const allRepos = queries.map(q => q.repos).flat();

        this.uniqueRepos = allRepos.filter(function ({ id }) {
            return !this.has(id) && this.add(id);
        }, new Set).sort((a, b) => (new Date(a.created_at)).getTime() - (new Date(b.created_at)).getTime());

        this.popularRepos = this.uniqueRepos.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 10);

        this.uniqueRepos.forEach((repo, i) => {
            const year = (new Date(repo.created_at)).getFullYear();
            YEARS_DICT[year].value += 1;
        });

        this.reposData = Object.values(YEARS_DICT);
    }

    async getContributors() {
        let allContribs = [], contribsDict = {};
        for (let i = 0; i < this.uniqueRepos.length; i++) {
            if (true) {
                const data = (await this.octokit.request(`GET /repos/${this.uniqueRepos[i].full_name}/contributors`, { per_page: 100 })).data;
                allContribs = [...allContribs, ...data];
            }
        }
        allContribs.forEach(user => {
            if (!contribsDict[user.login]) {
                contribsDict[user.login] = {};
                contribsDict[user.login]['repos_involved'] = 1;
                contribsDict[user.login]['profile'] = user;
                contribsDict[user.login]['total_contribs'] = user.contributions;
            } else {
                contribsDict[user.login]['total_contribs'] += user.contributions;
                contribsDict[user.login]['repos_involved'] += 1;
            }
        });
        this.contributors = Object.values(contribsDict).sort((a,b) => b['total_contribs'] - a['total_contribs']);
    }
}
