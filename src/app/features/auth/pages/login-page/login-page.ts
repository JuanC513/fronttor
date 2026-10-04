import { Component, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth/auth-service';
import { ForgotPasswordDialog } from '@features/auth/components/forgot-password-dialog/forgot-password-dialog';
import { LoginForm } from '@features/auth/components/login-form/login-form';
import { RegisterForm } from '@features/auth/components/register-form/register-form';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';

@Component({
  selector: 'app-login-page',
  imports: [TabsModule, MessageModule, LoginForm, RegisterForm, ForgotPasswordDialog],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly authService = inject(AuthService);

  readonly forgotDialogVisible = signal(false);
  readonly googleLoading = signal(false);
  readonly googleError = signal<string | null>(null);

  /**
   * Google vive en la página y no dentro de los formularios porque el bloque "O continúa con" es
   * común a ambas pestañas: registrarse e iniciar sesión con Google son la misma llamada.
   */
  async onGoogleLogin(): Promise<void> {
    this.googleLoading.set(true);
    this.googleError.set(null);

    try {
      // Redirige el navegador fuera de la app. Si la promesa resuelve sin redirigir es que algo
      // falló, por eso el spinner se apaga en el `catch` y no en un `finally`.
      await this.authService.signInWithGoogle();
    } catch (error) {
      this.googleError.set(authErrorMessage(error));
      this.googleLoading.set(false);
    }
  }
}
