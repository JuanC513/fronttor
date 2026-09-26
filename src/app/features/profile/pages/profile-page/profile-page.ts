import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { ProfileService } from '@core/services/profile/profile-service';
import { ButtonModule } from 'primeng/button';
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
  imports: [ButtonModule, FormsModule, MessageModule, TextareaModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  readonly maxLength = MAX_PERFIL_LENGTH;

  private readonly profile = toSignal(this.authService.profile$, { initialValue: null });

  readonly email = computed(() => this.profile()?.email ?? '');
  readonly description = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

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

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }
}
