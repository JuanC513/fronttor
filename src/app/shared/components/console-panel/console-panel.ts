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
}
