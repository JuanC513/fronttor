import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth/auth-service';
import { NotificationService } from '@core/services/notification/notification-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@features/auth/utils/auth-input-limits';
import { passwordsMatch } from '@features/auth/utils/passwords-match.validator';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';

/**
 * Cambiar la contraseña sin salir de la aplicación.
 *
 * Hasta ahora la única forma de cambiarla era cerrar sesión y pedir el enlace por correo, que es un
 * rodeo absurdo para quien ya está dentro y se acuerda de la suya.
 *
 * ## Por qué pide la contraseña actual
 *
 * `supabase/config.toml` tiene `secure_password_change = false`, así que Supabase acepta el cambio
 * con solo presentar una sesión válida: no comprueba la anterior. Sin pedirla aquí, cualquiera que
 * alcance un portátil desbloqueado con la aplicación abierta deja al dueño fuera de su propia
 * cuenta en dos clics. Se comprueba iniciando sesión con ella antes de tocar nada; si no cuadra,
 * `signIn` lanza y nunca se llega a `updatePassword`.
 *
 * Reautenticar así tiene un efecto secundario benigno: `onAuthStateChange` vuelve a disparar y
 * `AuthService` recarga el perfil. Es la misma sesión y el mismo usuario, así que no cambia nada de
 * lo que se está viendo.
 *
 * ## Por qué NO cierra la sesión al terminar
 *
 * `reset-password-page` sí lo hace, y allí es deliberado: aquella sesión es la del enlace de
 * recuperación y conviene matarla, además de obligar a probar la contraseña nueva. Aquí el
 * estudiante está en mitad de su trabajo y echarlo sería un castigo por haber cuidado su cuenta.
 */
@Component({
  selector: 'app-change-password-form',
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule],
  templateUrl: './change-password-form.html',
  styleUrl: './change-password-form.scss',
})
export class ChangePasswordForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  readonly maxPasswordLength = MAX_PASSWORD_LENGTH;

  readonly loading = signal(false);

  readonly form = this.formBuilder.group(
    {
      currentPassword: ['', [Validators.required, Validators.maxLength(MAX_PASSWORD_LENGTH)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(MIN_PASSWORD_LENGTH),
          Validators.maxLength(MAX_PASSWORD_LENGTH),
        ],
      ],
      confirmPassword: ['', [Validators.required, Validators.maxLength(MAX_PASSWORD_LENGTH)]],
    },
    { validators: passwordsMatch('password', 'confirmPassword') },
  );

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // El correo no se pide en el formulario: es el de la sesión, y pedirlo solo daría ocasión de
    // equivocarse escribiéndolo.
    const email = this.authService.getCurrentUser()?.email;

    if (!email) {
      this.notifications.error('Tu sesión expiró. Inicia sesión de nuevo.');
      return;
    }

    this.loading.set(true);

    const { currentPassword, password } = this.form.getRawValue();

    try {
      await this.authService.signIn(email, currentPassword);
      await this.authService.updatePassword(password);

      this.form.reset();
      this.notifications.exito('Contraseña actualizada');
    } catch (error) {
      this.notifications.error('No se pudo cambiar la contraseña', authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
