import { effect, Injectable, signal } from '@angular/core';
import { CodeRunnerState, ExecutionMode } from '../models/code-runner-model';

/**
 * El estado del taller: lo que se está escribiendo y lo que se está ejecutando.
 *
 * Son **dos estados y no uno**, y es la decisión que define este servicio. Si el previsualizador
 * leyera directamente el editor, cada pulsación relanzaría el código: imposible escribir un bucle
 * sin colgar la pestaña a mitad de teclearlo. Separándolos, quien decide cuándo se ejecuta es el
 * modo, no el teclado.
 *
 * No va en `root`: se provee por componente, para que cada taller abierto tenga el suyo y no
 * compartan el código ni la consola.
 */
@Injectable()
export class CodeRunnerStateService {
  /** Lo que hay en el editor ahora mismo. Cambia en cada pulsación. */
  private _editableState = signal<CodeRunnerState>({
    html: '',
    css: '',
    js: '',
  });

  /** Lo que el previsualizador está corriendo. Solo cambia cuando toca ejecutar. */
  private _executedState = signal<CodeRunnerState>({
    html: '',
    css: '',
    js: '',
  });

  /** Lo que el código del estudiante imprimió por consola en la ejecución actual. */
  private _logs = signal<string[]>([]);

  /** Si se ejecuta en cada cambio o solo al pulsar «Ejecutar». */
  private _executionMode = signal<ExecutionMode>('auto');

  // ========================
  // Getters públicos
  // ========================

  /** El código del editor, para enlazarlo a las pestañas. */
  readonly editableState = this._editableState.asReadonly();

  /** El código en ejecución, que es lo que el previsualizador renderiza. */
  readonly executedState = this._executedState.asReadonly();

  /** La salida de consola acumulada. */
  readonly logs = this._logs.asReadonly();

  /** El modo de ejecución vigente. */
  readonly executionMode = this._executionMode.asReadonly();

  /**
   * Engancha el modo automático.
   *
   * El `effect` depende de las dos señales a propósito: así cambiar a modo automático con código
   * ya escrito lo ejecuta de inmediato, sin esperar a la siguiente pulsación.
   */
  constructor() {
    effect(() => {
      const mode = this._executionMode();
      const editable = this._editableState();

      if (mode === 'auto') {
        this._executedState.set({ ...editable });
      }
    });
  }

  // ========================
  // Métodos
  // ========================

  /** Escribe la pestaña HTML. En modo automático, dispara una ejecución. */
  updateHtml(value: string) {
    this._editableState.update((state) => ({ ...state, html: value }));
  }

  /** Escribe la pestaña CSS. En modo automático, dispara una ejecución. */
  updateCss(value: string) {
    this._editableState.update((state) => ({ ...state, css: value }));
  }

  /** Escribe la pestaña JS. En modo automático, dispara una ejecución. */
  updateJs(value: string) {
    this._editableState.update((state) => ({ ...state, js: value }));
  }

  /**
   * Cambia entre ejecución automática y manual.
   *
   * Pasar a `auto` ejecuta lo que ya hubiera escrito, por el `effect` del constructor.
   */
  setExecutionMode(mode: ExecutionMode) {
    this._executionMode.set(mode);
  }

  /**
   * Copia el código del editor al estado ejecutado y limpia la consola.
   *
   * La consola se limpia aquí y no en el previsualizador porque los mensajes pertenecen a una
   * ejecución concreta: arrastrar los de la anterior haría leer un error ya resuelto como si
   * siguiera ahí.
   */
  run() {
    const editable = this._editableState();
    this._executedState.set({ ...editable });
    this.clearLogs();
  }

  /** Añade una línea a la consola. La llama el previsualizador con lo que llega del iframe. */
  addLog(message: string) {
    this._logs.update((logs) => {
      const next = logs.slice();
      next.push(message);
      return next;
    });
  }

  /** Vacía la consola. */
  clearLogs() {
    this._logs.set([]);
  }
}
