import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { AboutComponent } from './components/about/about.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { PublicNodesComponent } from './components/public-nodes/public-nodes.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { animation: 'HomePage' },
  },
  {
    path: 'about',
    component: AboutComponent,
    data: { animation: 'NodesPage' },
  },
  {
    path: 'public-nodes',
    component: PublicNodesComponent,
    data: { animation: 'NodesPage' },
  },
  {
    path: 'leaderboard',
    component: LeaderboardComponent,
    data: { animation: 'NodesPage' },
  },
  {
    path: '**',
    component: NotFoundComponent,
    data: { animation: 'NodesPage' },
  },
];
