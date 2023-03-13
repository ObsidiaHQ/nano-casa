import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, take } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Contributor, Profile, ServerResponse } from './interfaces';

@Injectable({
  providedIn: 'root',
})
export class SharedService {
  loggedUser = new BehaviorSubject<Profile>(null);
  selectedUser = new BehaviorSubject<Contributor>(null);
  data = new BehaviorSubject<ServerResponse>({
    repos: [],
    commits: [],
    contributors: [],
    milestones: [],
    events: [],
  });

  constructor(private http: HttpClient) {
    this.fetchUser();
    this.getData();
  }

  fetchUser() {
    if (!this.loggedUser.value) {
      this.http
        .get(`${environment.api}/auth/user`)
        .pipe(take(1))
        .subscribe((user: Profile) => this.loggedUser.next(user));
    }
  }

  selectUser(user: Contributor, editMode = false) {
    if (editMode) {
      const loggedContrib = this.data.value.contributors.find(
        (c) => c.login === this.loggedUser.value._id
      );
      this.selectedUser.next(loggedContrib);
    } else {
      this.selectedUser.next(user);
    }
  }

  getData(): void {
    if (!this.data.value.repos.length) {
      this.http
        .get(`${environment.api}/data`)
        .pipe(take(1))
        .subscribe((data: ServerResponse) => {
          data.contributors = data.contributors.map((usr) => {
            if (usr.profile) {
              usr.profile.bio = usr.profile.bio?.replace(
                /\[(.*?)\]\((.*?)\)/gim,
                "<a href='$2'>$1</a>"
              );
            }
            return usr;
          });
          this.data.next(data);
        });
    }
  }

  updateProfile() {
    //TODO loggedUser is not reactive !!
    // behSub with ngModel
    return this.http
      .post(`${environment.api}/set-profile`, this.loggedUser.value)
      .pipe(take(1));
  }

  logOut() {
    this.http
      .get(`${environment.api}/logout`)
      .pipe(take(1))
      .subscribe(() => this.loggedUser.next(null));
  }
}
