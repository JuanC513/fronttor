import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/** Cuánto vive cada aviso. Un «listo» se asimila de un vistazo; un fallo hay que leerlo. */
const VIDA_EXITO_MS = 3_000;
const VIDA_ERROR_MS = 6_000;

/**
 * Los avisos efímeros de la aplicación: el resultado de una acción que acaba de ocurrir.
 *
 * ## Qué va aquí y qué no
 *
 * Solo el **resultado de algo que el usuario hizo**: guardar, borrar, reordenar. Dos cosas se
 * quedan fuera a propósito, y no por descuido:
 *
 * - **Los fallos de carga.** No responden a ninguna pulsación y dejan la pantalla vacía, así que el
 *   aviso tiene que permanecer: van en línea, en la señal `error` de cada página.
 * - **Las validaciones previas al envío.** Señalan algo concreto de la pantalla que hay que
 *   corregir, y un mensaje que se desvanece no sirve para eso.
 *
 * ## Por qué un servicio propio y no `MessageService` directamente
 *
 * Son catorce sitios los que avisan. Repetir en cada uno `{ severity, summary, life }` es justo la
 * forma de que acaben divergiendo: un verde aquí, una duración distinta allá. El precedente está al
 * lado, en `FormErrorService`, que existe por la misma razón con el texto de los validadores.
 *
 * ## Dónde se pinta
 *
 * El `<p-toast />` vive en `AppLayout`, una sola vez para toda la aplicación. **Tiene que estar por
 * encima de quien emite**: los diálogos del profesor son rutas hijas que se destruyen al cerrarse,
 * así que un toast dentro de uno moriría en el mismo instante en que se emite el mensaje.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly messageService = inject(MessageService);

  exito(mensaje: string): void {
    this.messageService.add({ severity: 'success', summary: mensaje, life: VIDA_EXITO_MS });
  }

  /**
   * @param detalle El mensaje crudo del servicio. Se muestra debajo y en pequeño: al profesor le
   * dice qué falló de verdad, en vez de dejarlo con un «no se pudo» que no orienta.
   */
  error(mensaje: string, detalle?: string): void {
    this.messageService.add({
      severity: 'error',
      summary: mensaje,
      detail: detalle,
      life: VIDA_ERROR_MS,
    });
  }
}
