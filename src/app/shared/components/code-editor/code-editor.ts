import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  model,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import type * as Monaco from 'monaco-editor';

declare global {
  /**
   * Lo que Monaco cuelga de `window` al cargarse por su propio `loader.js`.
   *
   * Se declara aqui porque Monaco no se importa como modulo: llega por script, y sin esto
   * TypeScript no sabria que estas dos propiedades existen.
   */
  interface Window {
    /** El cargador AMD de Monaco: se configura con la ruta y luego se le piden modulos. */
    require: {
      config: (config: { paths: { vs: string } }) => void;
      (modules: string[], callback: () => void): void;
    };

    /** El espacio de nombres de Monaco, disponible una vez que el cargador termina. */
    monaco: typeof Monaco;
  }
}

type Language = keyof CodeRunnerState;

/**
 * Editor de HTML, CSS y JavaScript en pestañas, sobre Monaco.
 *
 * El contenido entra y sale por `value` en lugar de leerse de un servicio inyectado. Con el
 * servicio no se podía montar más de un editor por vista —los dos compartirían el mismo texto—, y
 * el formulario de ejercicios necesita dos: el código inicial y la solución.
 */
@Component({
  selector: 'app-code-editor',
  imports: [],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss',
  standalone: true,
})
export class CodeEditor implements AfterViewInit, OnDestroy {
  readonly value = model.required<CodeRunnerState>();

  private editor?: Monaco.editor.IStandaloneCodeEditor;
  private models?: Record<Language, Monaco.editor.ITextModel>;

  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  readonly activeTab = signal<Language>('html');
  readonly languages: Language[] = ['html', 'css', 'js'];

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  /**
   * Refleja en el editor los cambios que vengan de fuera.
   *
   * La comparación previa evita el ciclo: al escribir se emite `value`, esto vuelve a entrar, y
   * sin comprobar antes si el texto ya coincide se llamaría a `setValue` sobre el modelo que el
   * usuario está editando, moviéndole el cursor al principio.
   */
  private syncFromValue = effect(() => {
    const state = this.value();
    const models = this.models;
    if (!models) return;

    for (const language of this.languages) {
      if (models[language].getValue() !== state[language]) {
        models[language].setValue(state[language]);
      }
    }
  });

  private loadMonaco() {
    const onAmdLoaderReady = () => {
      window.require.config({
        paths: { vs: 'assets/monaco/vs' },
      });

      window.require(['vs/editor/editor.main'], () => {
        const monaco = window.monaco;
        const state = this.value();

        this.models = {
          html: monaco.editor.createModel(state.html, 'html'),
          css: monaco.editor.createModel(state.css, 'css'),
          js: monaco.editor.createModel(state.js, 'javascript'),
        };

        this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
          model: this.models[this.activeTab()],
          theme: 'vs-dark',
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
        });

        this.editor.onDidChangeModelContent(() => {
          this.value.update((current) => ({
            ...current,
            [this.activeTab()]: this.editor!.getValue(),
          }));
        });
      });
    };

    if (!window.require) {
      const loaderScript = document.createElement('script');
      loaderScript.src = 'assets/monaco/vs/loader.js';
      loaderScript.onload = onAmdLoaderReady;
      document.body.appendChild(loaderScript);
    } else {
      onAmdLoaderReady();
    }
  }

  /** Monaco se carga de forma asíncrona; hasta que termine no hay editor al que cambiarle nada. */
  changeTab(language: Language) {
    if (!this.editor || !this.models) return;

    this.activeTab.set(language);
    this.editor.setModel(this.models[language]);
  }

  label(language: Language): string {
    return language.toUpperCase();
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    if (this.models) {
      Object.values(this.models).forEach((model) => model.dispose());
    }
  }
}
