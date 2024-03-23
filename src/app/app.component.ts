import { Component, OnInit } from '@angular/core';
import { SharedService } from './shared.service';
import { IContributor, IProfile } from '../../interfaces';
import { ChildrenOutletContexts } from '@angular/router';
import { fader } from './animation';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  animations: [fader],
})
export class AppComponent implements OnInit {
  loggedUser: IProfile;
  selectedUser: IContributor;

  constructor(
    public shared: SharedService,
    private contexts: ChildrenOutletContexts
  ) {}

  ngOnInit() {
    this.shared.loggedUser.subscribe(
      (user: IProfile) => (this.loggedUser = user)
    );
    this.shared.selectedUser.subscribe(
      (user: IContributor) => (this.selectedUser = user)
    );
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }

  logIn() {
    window.open('/api/auth/github', '_self');
  }
}
