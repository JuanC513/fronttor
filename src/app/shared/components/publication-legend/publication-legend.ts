import { Component, input } from '@angular/core';

/**
 * Leyenda de los tres estados de publicación del panel del profesor.
 *
 * Vive aparte porque la necesitan las dos pestañas —Contenido y Ejercicios— y los iconos tienen
 * que significar lo mismo en ambas. Son los de `PublicationBadge`: tenerlos escritos a mano en dos
 * plantillas es justo como acaban divergiendo de lo que el badge pinta de verdad.
 */
@Component({
  selector: 'app-publication-legend',
  templateUrl: './publication-legend.html',
  styleUrl: './publication-legend.scss',
})
export class PublicationLegend {
  /**
   * Frase final sobre qué nace en borrador. Cambia según la pestaña, así que no puede ir fija
   * dentro de la plantilla.
   */
  readonly hint = input('');
}
