import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <img
        src="404.webp"
        alt="lost robot"
        style=" object-fit: cover; height: 100vh;"
      />
      <h2>
        You've reached unknown frontiers.<br />
        <a routerLink="/">&larr; Go home</a>
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
export class NotFoundComponent { }
