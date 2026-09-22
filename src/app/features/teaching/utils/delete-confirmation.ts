import { Confirmation } from 'primeng/api';

/**
 * Texto del `ConfirmPopup` de borrado.
 *
 * Corto a propósito: el popup se ensancha con el texto, y el detalle de lo que se pierde ya está
 * escrito y resaltado en el formulario, encima de los botones. Aquí solo hace falta el punto de
 * parada.
 */
export const DELETE_CONFIRM_MESSAGE = 'Esta acción no se puede deshacer.';

/**
 * Configuración del `ConfirmPopup` de borrado, igual en los cuatro formularios de contenido.
 *
 * `acceptButtonProps` va explícito aquí y también en el de publicación. No es redundante: cuando
 * una confirmación no lo define, `ConfirmPopup` pasa `undefined` al botón, que conserva el aspecto
 * de la confirmación anterior. Sin fijarlo en las dos, el «Guardar de todos modos» heredaba el
 * rojo del «Borrar» en cuanto se habían abierto los dos popups en la misma pantalla.
 */
export function deleteConfirmation(
  target: EventTarget | undefined,
  accept: () => void,
): Confirmation {
  return {
    target,
    message: DELETE_CONFIRM_MESSAGE,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Borrar',
    rejectLabel: 'Cancelar',
    acceptButtonProps: { severity: 'danger' },
    rejectButtonProps: { variant: 'outlined' },
    accept,
  };
}

/**
 * Cierre común de los avisos de borrado que arrastran contenido.
 *
 * Ahora que existe `is_published`, despublicar cubre casi todos los casos en los que antes había
 * que borrar, y sin perder nada.
 */
export const UNPUBLISH_INSTEAD =
  'Si solo quieres retirarlo del recorrido, despublícalo en vez de borrarlo.';
