import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { faCodeBranch, faHistory, faInfoCircle, faStar, faUsers } from '@fortawesome/free-solid-svg-icons';
import { ScaleType } from '@swimlane/ngx-charts';

interface Repo {
    name:             string,
    full_name:        string,
    created_at:       string,
    stargazers_count: number
}
interface Commit {
    count:            number, 
    date:             string
}
interface Contributor {
    login:            string,
    avatar_url:       string,
    contributions:    number,
    last_month:       number,
    repos:            string[],
    repos_count:      number
}
interface Misc {
    protocol_milestone: {
        title:         string,
        open_issues:   number,
        closed_issues: number
    },
    last_updated: any
}

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
    faInfo = faInfoCircle;

    reposData = [];
    popularRepos: Repo[] = [];
    popularReposPage: Repo[] = [];
    contributorsPage: Contributor[] = [];
    contributorsPageIndex = 0;

    repos: Repo[] = [];
    contributors: Contributor[] = [];
    commits = [{name: 'commits', series: []}];
    misc: Misc = {
        protocol_milestone: {
            title: '',
            open_issues: 0,
            closed_issues: 0
        },
        last_updated: ''
    }

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.getData();
    }

    getData(): void {
        this.http.get('https://nano.casa/data').subscribe((data: any) => {
            this.contributors = data.contributors;
            this.misc = data.misc;
            this.setRepos(data.repos);
            this.setCommits(data.commits);
        });
    }

    setRepos(repos: any[]) {
        this.repos = repos;
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

    setCommits(commits: Commit[]) {
        this.commits[0].series = commits.map((com) => ({ name: com.date, value: com.count }));
    }
}
