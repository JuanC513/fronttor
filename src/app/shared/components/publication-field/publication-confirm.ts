import { Confirmation } from 'primeng/api';

/**
 * Texto del `ConfirmPopup` que aparece al guardar un cambio que oculta contenido.
 */
export const PUBLICATION_CONFIRM_MESSAGE = 'Esto cambia lo que los estudiantes pueden ver.';

/**
 * Configuración del `ConfirmPopup` de guardado, igual en los tres formularios de contenido.
 *
 * @param target Elemento al que se ancla el popup.
 * @param accept Qué hacer si se confirma.
 */
export function publicationConfirmation(
  target: EventTarget | undefined,
  accept: () => void,
): Confirmation {
  return {
    target,
    message: PUBLICATION_CONFIRM_MESSAGE,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Guardar de todos modos',
    rejectLabel: 'Cancelar',
    rejectButtonProps: { variant: 'outlined' },
    accept,
  };
}
