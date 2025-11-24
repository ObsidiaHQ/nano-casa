import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SharedService } from '../../shared.service';
import { IconComponent } from '../icon/icon.component';
import { GoalComponent } from '../goal/goal.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, GoalComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  shared = inject(SharedService);
  private fb = inject(FormBuilder);

  saving = signal(false);
  success = signal(false);

  form = this.fb.group({
    bio: [''],
    twitterUsername: [''],
    website: [''],
    nanoAddress: ['', Validators.pattern(/^(nano_|xrb_)[13][13-9a-km-uw-z]{59}$/)],
    ghSponsors: [false],
    patreonUrl: [''],
    goalTitle: [''],
    goalAmount: [0],
    goalNanoAddress: ['', Validators.pattern(/^(nano_|xrb_)[13][13-9a-km-uw-z]{59}$/)],
    goalWebsite: [''],
    goalDescription: [''],
  });

  constructor() {
    effect(() => {
      const user = this.shared.loggedUser();
      if (user) {
        this.form.patchValue({
          bio: user.bio || '',
          twitterUsername: user.twitterUsername || '',
          website: user.website || '',
          nanoAddress: user.nanoAddress || '',
          ghSponsors: user.ghSponsors || false,
          patreonUrl: user.patreonUrl || '',
          goalTitle: user.goalTitle || '',
          goalAmount: user.goalAmount || 0,
          goalNanoAddress: user.goalNanoAddress || '',
          goalWebsite: user.goalWebsite || '',
          goalDescription: user.goalDescription || '',
        });
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.success.set(false);

    const formValue = this.form.value;
    const updatedProfile: any = {
      ...this.shared.loggedUser(),
      ...formValue,
    };

    try {
      await this.shared.updateProfile(updatedProfile);
      this.success.set(true);
      setTimeout(() => this.success.set(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      this.saving.set(false);
    }
  }
}
