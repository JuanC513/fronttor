import { Component, inject } from '@angular/core';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

/**
 * Muestra la salida de consola del codigo en ejecucion.
 *
 * Solo pinta: quien recibe los mensajes del iframe es `PreviewPanel`, que es el que tiene la
 * referencia con la que comprobar que vienen de ahi y no de otra ventana cualquiera.
 */
@Component({
  selector: 'app-console-panel',
  imports: [],
  templateUrl: './console-panel.html',
  styleUrl: './console-panel.scss',
  standalone: true,
})
export class ConsolePanel {
  private readonly codeRunnerStateService: CodeRunnerStateService = inject(CodeRunnerStateService);

  getLogs() {
    return this.codeRunnerStateService.logs();
  }

  /**
   * Vacia la consola sin volver a ejecutar nada.
   *
   * Vive aqui y no en la barra de la vista porque es una accion sobre lo que este panel muestra, y
   * asi la tienen las dos vistas que lo montan sin que ninguna la cablee por su cuenta. El servicio
   * ya la expone; lo que faltaba era el boton.
   */
  clear() {
    this.codeRunnerStateService.clearLogs();
  }
}
