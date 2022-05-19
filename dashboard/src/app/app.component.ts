import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { faCodeBranch, faHistory, faInfoCircle, faMedal, faStar, faUsers, faStarOfLife, faMeteor, faArrowDown, faAngleDown, faHeart, faExternalLink, faCodeCommit, faCodePullRequest, faGhost } from '@fortawesome/free-solid-svg-icons';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { ScaleType } from '@swimlane/ngx-charts';

interface Repo {
    name:             string,
    full_name:        string,
    created_at:       string,
    stargazers_count: number,
    prs_30d:          number,
    commits_30d:      number,
    avatar_url:       string  
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
    repos_count:      number,
    profile:          any
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
    faTwitter = faTwitter;
    faGithub = faGithub;
    faMedal = faMedal;
    faStarOL = faStarOfLife;
    faMeteor = faMeteor;
    faDown = faArrowDown;
    faMore = faAngleDown;
    faHeart = faHeart;
    faExt = faExternalLink;
    faCommit = faCodeCommit;
    faPR = faCodePullRequest;
    faGhost = faGhost;

    reposData = [];
    popularRepos: Repo[] = [];
    popularReposNames: string[] = [];
    popularReposPage: Repo[] = [];
    contributorsPage: Contributor[] = [];
    contributorsPageIndex = 0;

    busyRepos: Repo[] = [];
    recentRepos: Repo[] = [];
    repos: Repo[] = [];
    contributors: Contributor[] = [];
    commits = [{name: 'commits', series: []}];
    misc: Misc = {
        protocol_milestone: {
            title: '',
            open_issues: 0,
            closed_issues: 0
        },
        last_updated: null
    }
    filterBy: string = 'total';

    constructor(private http: HttpClient) { }

    ngOnInit() {
        this.getData();
    }

    getData(): void {
        this.http.get('https://nano.casa/data').subscribe((data: any) => {
            this.contributors = data.contributors;
            this.contributors = this.contributors.map(usr => {
                const profile = data.devList.find(dl => dl.github.toLowerCase() === usr.login.toLowerCase());
                if (profile)
                    profile.description = profile.description.replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>");
                return ({...usr, profile });
            });
            this.misc = data.misc;
            this.setRepos(data.repos);
            this.setCommits(data.commits);
        });
    }

    setRepos(repos: Repo[]) {
        this.repos = repos;
        this.recentRepos = [...repos].reverse();
        this.popularRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
        this.busyRepos = [...repos].filter(a => (a.commits_30d + a.prs_30d) > 0).sort((a, b) => (b.commits_30d + b.prs_30d) - (a.commits_30d + a.prs_30d));
        this.popularReposNames = this.popularRepos.map(r => r.full_name);

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

    hasPopularRepo(repos: string[]) {
        return repos.some(r => this.popularReposNames.indexOf(r) >= 0 && this.popularReposNames.indexOf(r) < 10 && r != 'nanocurrency/nano-node');
    }

    contributedToNode(repos: string[]) {
        return repos.includes('nanocurrency/nano-node');
    }

    sortContributors(by: 'month' | 'total') {
        if (this.filterBy === by) return;
        this.filterBy = by;
        this.contributors = [...this.contributors].sort((a,b) => by === 'total' ? (b.contributions - a.contributions) : (b.last_month - a.last_month));
    }
}
