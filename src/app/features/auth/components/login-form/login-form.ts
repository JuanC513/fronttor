import { Component, inject, output, signal } from '@angular/core';
import { ReactiveFormsModule, Validators } from '@angular/forms';
import { NonNullableFormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

@Component({
  selector: 'app-login-form',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './login-form.html',
  styleUrl: './login-form.scss',
})
export class LoginForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** El diálogo de recuperación vive en la página, no aquí: el formulario solo lo solicita. */
  readonly forgotPassword = output<void>();

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.authService.signIn(email, password);
      await this.router.navigate(['/home']);
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
