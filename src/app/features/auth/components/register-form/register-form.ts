import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { passwordsMatch } from '@features/auth/utils/passwords-match.validator';
import { FieldError } from '@shared/components/field-error/field-error';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

/** Mínimo de caracteres exigido en el cliente. */
const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-register-form',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    MessageModule,
    FieldError,
  ],
  templateUrl: './register-form.html',
  styleUrl: './register-form.scss',
})
export class RegisterForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly confirmationSent = signal(false);

  readonly registerForm = this.formBuilder.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const { email, password } = this.registerForm.getRawValue();

    try {
      const data = await this.authService.signUp(email, password);

      if (data.session) {
        // La confirmación por correo está desactivada en Supabase: la cuenta ya quedó activa.
        await this.router.navigate(['/home']);
        return;
      }

      // Sin sesión significa que hay confirmación por correo pendiente. Ojo: cuando esa opción está
      // activa Supabase tampoco devuelve error si el correo ya existía (protección contra
      // enumeración de usuarios), así que el mensaje se redacta para ser cierto en ambos casos.
      this.confirmationSent.set(true);
      this.registerForm.reset();
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
