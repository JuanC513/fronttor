import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * Conmutador entre las dos vistas de Administración.
 *
 * El estado activo se calcula de la URL en vez de con `routerLinkActive` porque las dos rutas
 * comparten prefijo: `/admin` sin coincidencia exacta se activaría también estando en
 * `/admin/exercises`, y con coincidencia exacta se apagaría al abrir cualquier diálogo, que son
 * rutas hijas suyas como `/admin/module/new`.
 */
@Component({
  selector: 'app-admin-tabs',
  imports: [RouterLink],
  templateUrl: './admin-tabs.html',
  styleUrl: './admin-tabs.scss',
})
export class AdminTabs {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly onExercises = computed(() => this.url().startsWith('/admin/exercises'));
}
