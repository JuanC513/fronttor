import { Component, inject, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth/auth-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-forgot-password-dialog',
  imports: [
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    MessageModule,
  ],
  templateUrl: './forgot-password-dialog.html',
  styleUrl: './forgot-password-dialog.scss',
})
export class ForgotPasswordDialog {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);

  /** Two-way binding con la página, que es quien decide cuándo abrirlo. */
  readonly visible = model(false);

  readonly loading = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly emailSent = signal(false);

  readonly forgotForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit(): Promise<void> {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    const { email } = this.forgotForm.getRawValue();

    try {
      await this.authService.sendPasswordReset(email);
      // El mensaje es deliberadamente ambiguo: confirmar que un correo existe permitiría
      // enumerar las cuentas registradas.
      this.emailSent.set(true);
    } catch (error) {
      this.serverError.set(authErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  onHide(): void {
    this.forgotForm.reset();
    this.serverError.set(null);
    this.emailSent.set(false);
  }
}
