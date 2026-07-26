import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { filter, take } from 'rxjs/operators';

/**
 * Pantalla de paso al volver de Google o del enlace de confirmación de correo.
 *
 * No necesita hablar con Supabase: el cliente está configurado con `detectSessionInUrl`, así que
 * ya canjeó el `?code=` de la URL antes de que `AuthService` resuelva su inicialización. Aquí solo
 * se espera a `initialized$` y se decide a dónde mandar al usuario.
 */
@Component({
  selector: 'app-auth-callback-page',
  imports: [ProgressSpinnerModule, ButtonModule, RouterLink],
  templateUrl: './auth-callback-page.html',
  styleUrl: './auth-callback-page.scss',
})
export class AuthCallbackPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Cuando el proveedor rechaza la autenticación, Supabase devuelve el motivo en la URL.
    const errorDescription = this.activatedRoute.snapshot.queryParamMap.get('error_description');

    if (errorDescription) {
      this.errorMessage.set('No pudimos completar el inicio de sesión. Inténtalo de nuevo.');
      return;
    }

    this.authService.initialized$.pipe(filter(Boolean), take(1)).subscribe(() => {
      if (this.authService.getCurrentUser()) {
        this.router.navigate(['/home']);
        return;
      }

      this.errorMessage.set('El enlace ya fue usado o expiró. Vuelve a iniciar sesión.');
    });
  }
}
