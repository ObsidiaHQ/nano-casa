import { Component, OnInit } from '@angular/core';
import { SharedService } from './shared.service';
import { Contributor, Profile, ServerResponse } from './interfaces';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  loggedUser: Profile;
  selectedUser: Contributor;

  constructor(public shared: SharedService) {}

  ngOnInit() {
    this.shared.loggedUser.subscribe(
      (user: Profile) => (this.loggedUser = user)
    );
    this.shared.selectedUser.subscribe(
      (user: Contributor) => (this.selectedUser = user)
    );
  }

  logIn() {
    window.open('/auth/github', '_self');
  }
}
