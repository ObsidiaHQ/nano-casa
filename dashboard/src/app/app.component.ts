import { Component, OnInit } from '@angular/core';
import { ApiService } from './api.service';
import { Contributor, Profile, ServerResponse } from './interfaces';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  loggedUser: Profile;
  data: ServerResponse;
  selectedUser: Contributor;

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.api.loggedUser.subscribe((user: Profile) => (this.loggedUser = user));
    this.api.data.subscribe((data: ServerResponse) => (this.data = data));
    this.api.selectedUser.subscribe(
      (user: Contributor) => (this.selectedUser = user)
    );
  }

  logIn() {
    window.open('/auth/github', '_self');
  }
}
