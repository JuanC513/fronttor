import { Component, computed, input } from '@angular/core';
import { PublicationStatus } from '@domain/learning/utils/publication-state';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Indicador de publicación de un tema, subtema o bloque en el panel del profesor.
 *
 * Es solo un icono, el detalle va en el tooltip, que es donde importa: "no visible" no es
 * un motivo sino varios, y saber cuál es lo único accionable.
 */
@Component({
  selector: 'app-publication-badge',
  imports: [TooltipModule],
  templateUrl: './publication-badge.html',
  styleUrl: './publication-badge.scss',
})
export class PublicationBadge {
  readonly status = input.required<PublicationStatus>();

  readonly icon = computed(() => {
    switch (this.status().state) {
      case 'published':
        return 'pi pi-check-circle';
      case 'hidden':
        return 'pi pi-exclamation-triangle';
      case 'draft':
        return 'pi pi-eye-slash';
    }
  });

  readonly tooltip = computed(() => {
    const status = this.status();

    switch (status.state) {
      case 'published':
        return 'Publicado: los estudiantes lo ven.';
      case 'hidden':
        return `Publicado pero no se muestra: ${status.reason?.toLowerCase()}.`;
      case 'draft':
        return 'Borrador: no se muestra a los estudiantes.';
    }
  });
}
