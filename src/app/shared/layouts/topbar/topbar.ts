import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { BreadcrumbService } from '@core/services/breadcrumb/breadcrumb-service';
import { AiChatService } from '@domain/ai/services/ai-chat-service';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { filter, map } from 'rxjs/operators';

interface Seccion {
  lista: string;
  etiqueta: string;
  detalle: RegExp;
  /**
   * Etiqueta fija para el detalle, cuando lo que se abre no es una entidad guardada y por tanto no
   * tiene un nombre que publicar. Si falta, el escalón lo pone la vista con `BreadcrumbService`.
   */
  detalleEtiqueta?: string;
}

/** Las secciones con miga de pan: la lista y, debajo, su vista de detalle. */
const SECCIONES: Seccion[] = [
  {
    lista: '/learning/modules',
    etiqueta: 'Módulos',
    detalle: /^\/learning\/modules\/\d+\/lessons\/\d+/,
  },
  { lista: '/learning/exercises', etiqueta: 'Ejercicios', detalle: /^\/learning\/exercises\/\d+/ },
  {
    // El ejercicio de la práctica guiada se genera y se descarta con la pantalla: no hay entidad
    // que nombrar, y su título ya sale en el encabezado. Por eso este escalón es fijo, y además
    // aparece desde que se entra, antes de haber pedido nada.
    lista: '/playground',
    etiqueta: 'Libre',
    detalle: /^\/playground\/practice/,
    detalleEtiqueta: 'Práctica guiada',
  },
];

@Component({
  selector: 'app-topbar',
  imports: [DividerModule, BreadcrumbModule, ButtonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly chatService = inject(AiChatService);
  private readonly breadcrumbService = inject(BreadcrumbService);

  home: MenuItem = { icon: 'pi pi-home', routerLink: '/home' };

  /** Hay chat disponible solo si alguna vista publicó contexto. */
  readonly chatContext = this.chatService.context;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Se recalcula con la ruta y con el nombre que publique la vista de detalle.
   *
   * Depender de las dos cosas es lo que obliga a que sea un `computed` y no una lista que se
   * reescribe en la suscripción: el nombre llega DESPUÉS de la navegación, cuando la página termina
   * de cargar, y así no hace falta acordarse de volver a armar la miga en ese momento.
   */
  readonly breadcrumbItems = computed<MenuItem[]>(() => {
    const url = this.url();
    const titulo = this.breadcrumbService.title();

    for (const seccion of SECCIONES) {
      if (seccion.detalle.test(url)) {
        // Con etiqueta fija el escalón está desde el primer momento; con nombre publicado llega
        // cuando la vista termina de cargar, y hasta entonces se pinta solo el padre. Rellenar el
        // hueco con un número sería peor: el ejercicio `id` 2 se llama «Ejercicio 01», así que la
        // miga desmentiría al título de la página.
        const hoja = seccion.detalleEtiqueta ?? titulo;

        return [
          { label: seccion.etiqueta, routerLink: seccion.lista },
          ...(hoja ? [{ label: hoja }] : []),
        ];
      }

      if (url.startsWith(seccion.lista)) {
        return [{ label: seccion.etiqueta }];
      }
    }

    return [];
  });

  openChat(): void {
    this.chatService.open();
  }
}
