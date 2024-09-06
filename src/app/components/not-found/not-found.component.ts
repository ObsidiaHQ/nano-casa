import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  template: `
    <div class="container">
      <img
        src="assets/404.webp"
        alt="lost robot"
        style=" object-fit: cover; height: 100vh;"
      />
      <h2>
        You've reached unknown frontiers.<br />
        <a routerLink="/"> Go home</a>
      </h2>
    </div>
  `,
  styles: `
    h2 {
      position: absolute;
      top: 55%;
      left: 40%;
      transform: translate(-50%, -50%);
    }
  `,
})
export class NotFoundComponent {}
