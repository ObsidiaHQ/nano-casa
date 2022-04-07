import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { faCodeBranch, faHistory, faStar, faUsers } from '@fortawesome/free-solid-svg-icons';
import { ScaleType } from '@swimlane/ngx-charts';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    ScaleType = ScaleType;
    faRepo = faCodeBranch;
    faUser = faUsers;
    faStar = faStar;
    faHistory = faHistory;

    reposData = [];
    popularRepos = [];
    popularReposPage = [];
    contributorsPage = [];
    contributorsPageIndex = 0;

    data = {
        repos: [],
        contributors: [],
        commits: [{name: 'commits', series: []}],
        misc: {
            protocol_milestone: {
                title: '',
                open_issues: 0,
                closed_issues: 0
            }
        }
    };

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.getData();
    }

    getData(): void {
        this.http.get('https://nano.casa/data').subscribe((data: any) => {
            this.data.contributors = data.contributors;
            this.data.misc = data.misc;
            this.setRepos(data.repos);
            this.setCommits(data.commits);
        });
    }

    setRepos(repos: any[]) {
        this.data.repos = repos;
        this.popularRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);

        // list years since 2014
        const YEARS = Array.from(Array(new Date().getFullYear() - 2013), (_, i) => (i + 2014).toString());
        const YEARS_DICT = {};
        for (const year of YEARS) { YEARS_DICT[year] = { name: year, value: 0 } }

        repos.forEach((repo, i) => {
            const year = (new Date(repo.created_at)).getFullYear();
            YEARS_DICT[year].value += 1;
        });

        this.reposData = Object.values(YEARS_DICT);
    }

    setCommits(commits: any[]) {
        this.data.commits[0].series = commits.map((com) => ({ name: `${com._id.year}|${com._id.week}`, value: com.count }));
    }
}
