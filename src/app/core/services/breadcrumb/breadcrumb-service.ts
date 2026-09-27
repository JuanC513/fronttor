import { Injectable, signal } from '@angular/core';

/**
 * El nombre de lo que se está viendo, para el último escalón de la miga de pan.
 *
 * El topbar arma la miga desde la URL, y de la URL solo salen identificadores. Eso bastaba mientras
 * el último escalón fuera un número, pero un número no dice nada: el ejercicio con `id` 2 se llama
 * «Ejercicio 01», así que la miga y el título de la página se contradecían.
 *
 * Es el mismo reparto que ya usa `AiChatService.context`: la vista de detalle publica lo que solo
 * ella sabe, y el layout lo consume sin conocerla.
 *
 * **Cada vista que lo fija tiene que limpiarlo al salir**, en su `ngOnDestroy`. Si no, el nombre
 * viejo se quedaría colgado en la miga de la siguiente pantalla mientras esta carga.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly current = signal<string | null>(null);

  /** `null` mientras no haya nada que nombrar: el topbar entonces pinta solo el escalón padre. */
  readonly title = this.current.asReadonly();

  setTitle(title: string): void {
    this.current.set(title);
  }

  clear(): void {
    this.current.set(null);
  }
}
