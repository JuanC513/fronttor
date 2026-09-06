import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ToggleImpact } from '@domain/learning/utils/publication-state';
import { MessageModule } from 'primeng/message';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

/**
 * Interruptor de publicación con su explicación, compartido por los formularios de tema, subtema
 * y bloque.
 *
 * El aviso va **en línea** y no en un diálogo de confirmación por tres razones:
 *
 * 1. Los formularios ya son diálogos, y apilar un modal sobre otro es un problema de foco.
 * 2. Mover el interruptor todavía no persiste nada. Confirmar un cambio reversible y sin guardar
 *    es una falsa alarma; el momento honesto para preguntar es al guardar, y de eso se encarga el
 *    `ConfirmPopup` de cada formulario cuando el cambio oculta algo que hoy se ve.
 * 3. Un mensaje en línea se queda ahí mientras se termina de editar; un popup se cierra y ya no
 *    se puede volver a consultar.
 */
@Component({
  selector: 'app-publication-field',
  imports: [ReactiveFormsModule, ToggleSwitchModule, MessageModule],
  templateUrl: './publication-field.html',
  styleUrl: './publication-field.scss',
})
export class PublicationField {
  readonly control = input.required<FormControl<boolean>>();
  readonly isEditForm = input.required<boolean>();
  /** Consecuencia de dejar el interruptor como está ahora. `null` si no se ha movido. */
  readonly impact = input<ToggleImpact | null>(null);
  /** Cómo se nombra lo que se está editando dentro del aviso de creación. */
  readonly entityLabel = input.required<string>();
  /**
   * Realza el aviso mientras está abierto el `ConfirmPopup` de guardado.
   *
   * El popup pregunta pero no explica; el texto que sí explica es este, y en ese momento tiene que
   * ser lo primero que se lea.
   */
  readonly highlight = input(false);
}
