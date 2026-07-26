import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { passwordsMatch } from '@features/auth/utils/passwords-match.validator';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { filter, take } from 'rxjs/operators';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Destino del enlace "¿Olvidaste tu contraseña?".
 *
 * El enlace del correo trae consigo una sesión de recuperación que el cliente de Supabase canjea
 * solo (`detectSessionInUrl`). Si al terminar de inicializar no hay usuario, es que el enlace
 * expiró o ya se usó.
 */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule, MessageModule, RouterLink],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly checkingLink = signal(true);
  readonly linkIsValid = signal(false);
  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly passwordUpdated = signal(false);

  readonly resetForm = this.formBuilder.group(
    {
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  ngOnInit(): void {
    this.authService.initialized$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.linkIsValid.set(!!this.authService.getCurrentUser());
      this.checkingLink.set(false);
    });
  }

  async onSubmit(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const { password } = this.resetForm.getRawValue();

    try {
      await this.authService.updatePassword(password);
      // Se cierra la sesión de recuperación a propósito: obliga a entrar con la contraseña nueva,
      // que es la forma de comprobar que quedó bien guardada.
      await this.authService.signOut();
      this.passwordUpdated.set(true);
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
