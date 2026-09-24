import { Component, effect, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { CodeEditor } from '@shared/components/code-editor/code-editor';
import { ConsolePanel } from '@shared/components/console-panel/console-panel';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';
import { clearCode, loadCode, saveCode } from '../../utils/playground-storage';

const EMPTY_CODE: CodeRunnerState = { html: '', css: '', js: '' };

/**
 * Cuánto se espera antes de guardar en el navegador.
 *
 * En modo automático el estado cambia con cada pulsación, y `localStorage` escribe de forma
 * síncrona: sin este respiro se escribiría el documento entero letra a letra.
 */
const SAVE_DELAY_MS = 500;

/**
 * Práctica libre: escribir código y ver el resultado, sin ejercicio de por medio.
 *
 * Comparte el motor entero con la vista de resolución —el mismo editor, el mismo iframe, la misma
 * consola y el mismo `CodeRunnerStateService`—. La diferencia es que aquí no hay nada que validar
 * ni que registrar: lo que se escribe no se califica y no toca la base de datos.
 */
@Component({
  selector: 'app-playground-page',
  imports: [
    ButtonModule,
    CodeEditor,
    ConfirmPopupModule,
    ConsolePanel,
    FormsModule,
    PreviewPanel,
    ToggleSwitchModule,
  ],
  templateUrl: './playground-page.html',
  styleUrl: './playground-page.scss',
  standalone: true,
  providers: [ConfirmationService, CodeRunnerStateService],
})
export class PlaygroundPage implements OnDestroy {
  private readonly codeRunnerStateService = inject(CodeRunnerStateService);
  private readonly confirmationService = inject(ConfirmationService);

  /** Ancla de la confirmación de «Limpiar». El `read` evita recibir la instancia del `p-button`. */
  private readonly clearAnchor = viewChild('clearAnchor', { read: ElementRef });

  readonly editableState = this.codeRunnerStateService.editableState;

  /**
   * Si el código se ejecuta según se escribe.
   *
   * Se expone como booleano y no como el `'auto' | 'manual'` del servicio porque lo que lo enlaza
   * es un interruptor, y traducir el modo en la plantilla la llenaría de comparaciones con cadenas.
   */
  readonly autoRun = signal(this.codeRunnerStateService.executionMode() === 'auto');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const saved = loadCode();
    if (saved) this.applyCode(saved);

    // Guardar es un efecto del estado, no de cada acción: así queda cubierto lo que se escribe, lo
    // que se pega y cualquier camino futuro que toque el código, sin tener que acordarse de llamar.
    effect(() => {
      const code = this.editableState();

      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => saveCode(code), SAVE_DELAY_MS);
    });
  }

  ngOnDestroy(): void {
    // Sin esto se pierde lo último escrito al salir de la vista, que es justo cuando más molesta.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      saveCode(this.editableState());
    }
  }

  onCodeChange(state: CodeRunnerState) {
    this.applyCode(state);
  }

  onAutoRunChange(auto: boolean) {
    this.autoRun.set(auto);
    this.codeRunnerStateService.setExecutionMode(auto ? 'auto' : 'manual');
  }

  /**
   * Vuelve a montar el iframe con el código actual y limpia la consola.
   *
   * Disponible también en automático, donde el estado ejecutado ya coincide con el del editor: ahí
   * sirve para partir de una salida limpia, que es lo que se quiere cuando la consola se ha llenado
   * o el documento quedó en un estado raro.
   */
  run() {
    this.codeRunnerStateService.run();
  }

  onClear() {
    this.confirmationService.confirm({
      target: this.clearAnchor()?.nativeElement,
      message: 'Se borrará el código que tengas escrito. Esto no se puede deshacer.',
      icon: 'pi pi-trash',
      acceptLabel: 'Limpiar',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { variant: 'outlined' },
      accept: () => {
        this.applyCode(EMPTY_CODE);
        this.codeRunnerStateService.clearLogs();
        clearCode();
      },
    });
  }

  private applyCode(code: CodeRunnerState) {
    this.codeRunnerStateService.updateHtml(code.html);
    this.codeRunnerStateService.updateCss(code.css);
    this.codeRunnerStateService.updateJs(code.js);
  }
}
