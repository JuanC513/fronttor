import { effect, Injectable, signal } from '@angular/core';
import { CodeRunnerState, ExecutionMode } from '../models/code-runner-model';

@Injectable()
export class CodeRunnerStateService {
  // Estado editable
  private _editableState = signal<CodeRunnerState>({
    html: '',
    css: '',
    js: '',
  });

  // Estado ejecutado
  private _executedState = signal<CodeRunnerState>({
    html: '',
    css: '',
    js: '',
  });

  // Logs de consola
  private _logs = signal<string[]>([]);

  // Modo
  private _executionMode = signal<ExecutionMode>('auto');

  // ========================
  // Getters públicos
  // ========================

  readonly editableState = this._editableState.asReadonly();
  readonly executedState = this._executedState.asReadonly();
  readonly logs = this._logs.asReadonly();
  readonly executionMode = this._executionMode.asReadonly();

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

  updateHtml(value: string) {
    this._editableState.update((state) => ({ ...state, html: value }));
  }

  updateCss(value: string) {
    this._editableState.update((state) => ({ ...state, css: value }));
  }

  updateJs(value: string) {
    this._editableState.update((state) => ({ ...state, js: value }));
  }

  setExecutionMode(mode: ExecutionMode) {
    this._executionMode.set(mode);
  }

  run() {
    const editable = this._editableState();
    this._executedState.set({ ...editable });
    this.clearLogs();
  }

  addLog(message: string) {
    this._logs.update((logs) => {
      const next = logs.slice();
      next.push(message);
      return next;
    });
  }

  clearLogs() {
    this._logs.set([]);
  }
}
