import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { ProfileService } from '@core/services/profile/profile-service';
import { authErrorMessage } from '@features/auth/utils/auth-error-messages';
import { ChangePasswordForm } from '@features/profile/components/change-password-form/change-password-form';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

/**
 * Debe coincidir con MAX_PERFIL_LENGTH en
 * supabase/functions/_shared/student-context.ts.
 *
 * No se importa desde ahí: Angular no compila archivos fuera de `src/`. La sincronización la
 * garantiza `scripts/check-prompt-limits-sync.mjs`, que `npm run check` corre en cada commit.
 */
export const MAX_PERFIL_LENGTH = 1_000;

@Component({
  selector: 'app-profile-page',
  imports: [
    ButtonModule,
    ChangePasswordForm,
    ConfirmPopupModule,
    FormsModule,
    MessageModule,
    TextareaModule,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  // Local y no global, como en el resto de la aplicación: cada vista trae el suyo con el
  // `p-confirmpopup` que lo pinta.
  providers: [ConfirmationService],
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  /** Ancla de la confirmación. El `read` evita recibir la instancia del `p-button`. */
  private readonly logoutAnchor = viewChild('logoutAnchor', { read: ElementRef });

  readonly maxLength = MAX_PERFIL_LENGTH;

  private readonly profile = toSignal(this.authService.profile$, { initialValue: null });
  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  readonly email = computed(() => this.profile()?.email ?? '');

  /**
   * Desde cuándo tiene cuenta, en «mes de año».
   *
   * Cadena vacía si `created_at` no viene, y entonces la línea no se pinta: la columna es `not null`
   * en la base, pero en la interfaz está declarada opcional y un perfil a medio cargar no debe
   * enseñar «Invalid Date».
   *
   * El formato sale de `toLocaleDateString` y no del `DatePipe` de Angular porque la aplicación no
   * registra ningún locale —`app.config.ts` no tiene `LOCALE_ID`—, así que `date: 'MMMM y'` saldría
   * en inglés. Registrar el locale entero por una sola fecha es más de lo que hace falta.
   */
  readonly memberSince = computed(() => {
    const createdAt = this.profile()?.created_at;
    if (!createdAt) return '';

    const fecha = new Date(createdAt);
    if (Number.isNaN(fecha.getTime())) return '';

    return fecha.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  });

  /**
   * Si la cuenta tiene contraseña propia que se pueda cambiar.
   *
   * Quien entró con Google no la tiene: la gestiona Google, y `updateUser({ password })` sobre esa
   * cuenta no es lo que el estudiante creería estar haciendo. Se miran los dos campos porque
   * `provider` es solo el del último inicio de sesión, mientras que `providers` los lista todos: una
   * cuenta de correo que alguna vez entró con Google sigue teniendo su contraseña.
   */
  readonly tienePassword = computed(() => {
    const metadata = this.user()?.app_metadata;
    if (!metadata) return false;

    const providers: unknown = metadata['providers'];

    return (
      metadata.provider === 'email' ||
      (Array.isArray(providers) && (providers as unknown[]).includes('email'))
    );
  });

  readonly description = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  /**
   * Por qué no se pudo cerrar la sesión.
   *
   * Señal aparte de `error`, que se pinta dentro de la tarjeta del tutor: un fallo al salir no
   * tiene nada que ver con la descripción, y aparecería a media página del botón que se acaba de
   * pulsar.
   */
  readonly logoutError = signal<string | null>(null);

  /** Lo guardado, para saber si hay algo que guardar. */
  private readonly stored = computed(() => this.profile()?.profile_description ?? '');

  readonly canSave = computed(
    () => !this.saving() && this.description().trim() !== this.stored().trim(),
  );

  /**
   * Si el estudiante ya tocó el campo.
   *
   * Es lo que separa «todavía no ha llegado el perfil» de «lo dejó vacío a propósito». Sin esta
   * distinción no se puede borrar la descripción: la primera versión miraba si el campo estaba
   * vacío para decidir si rellenarlo, así que al borrarlo todo el texto guardado volvía solo.
   */
  private readonly touched = signal(false);

  constructor() {
    // El perfil llega de forma asíncrona y puede recargarse, así que el campo lo sigue en vez de
    // leerlo una vez. Deja de seguirlo en cuanto el estudiante escribe: si el perfil se recarga por
    // detrás mientras edita, no se le pisa lo que lleva a medias.
    effect(() => {
      const stored = this.stored();

      untracked(() => {
        if (!this.touched()) this.description.set(stored);
      });
    });
  }

  async save(): Promise<void> {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId || !this.canSave()) return;

    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);

    try {
      await this.profileService.saveDescription(userId, this.description());

      // Sin esto `profile$` se quedaría con el texto anterior, y la vista mostraría lo viejo justo
      // después de haber escrito lo nuevo.
      await this.authService.refreshProfile();
      this.saved.set(true);
    } catch (err) {
      this.error.set('No se pudo guardar. ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      this.saving.set(false);
    }
  }

  onDescriptionChange(value: string): void {
    this.touched.set(true);
    this.description.set(value);
    this.saved.set(false);
  }

  /**
   * Pregunta antes de cerrar la sesión.
   *
   * El botón está arriba a la derecha de la cabecera, que es donde la mano va a parar sola, y
   * volver a entrar con Google no es inmediato. La confirmación dice además lo que de verdad
   * preocupa al leer «cerrar sesión»: que no se pierde nada.
   *
   * Es el mismo `ConfirmationService` anclado al botón que ya usan «Limpiar» del taller y los
   * diálogos del profesor, en vez de un modal propio.
   */
  onLogout(): void {
    this.confirmationService.confirm({
      target: this.logoutAnchor()?.nativeElement,
      message: 'Se cerrará tu sesión en este navegador. Tu progreso y lo que escribiste se quedan.',
      icon: 'pi pi-sign-out',
      acceptLabel: 'Cerrar sesión',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { variant: 'outlined' },
      accept: () => void this.logout(),
    });
  }

  /**
   * Cierra la sesión y vuelve al login.
   *
   * **No navega si `signOut` falla.** Antes lo hacía —la llamada no estaba protegida— y el efecto
   * era el peor posible: la confirmación se cerraba, no pasaba nada más y parecía que había
   * funcionado, con la sesión todavía abierta. Quedándose aquí, el aviso sale justo debajo del
   * botón que se acaba de pulsar y el estudiante puede reintentarlo.
   *
   * Si el fallo fue que la sesión ya no existía, `supabase-js` la limpia igualmente y
   * `onAuthStateChange` dispara; de sacar al estudiante de aquí se encarga entonces `authGuard`, que
   * es de quien es ese trabajo.
   */
  async logout() {
    this.logoutError.set(null);

    try {
      await this.authService.signOut();
    } catch (err) {
      // `AuthService` relanza el `AuthError` crudo, que es justo lo que este traductor necesita.
      this.logoutError.set('No se pudo cerrar la sesión. ' + authErrorMessage(err));
      return;
    }

    this.router.navigate(['/login']);
  }
}
