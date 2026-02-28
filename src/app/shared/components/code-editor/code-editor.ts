import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import type * as Monaco from 'monaco-editor';

@Component({
  selector: 'app-code-editor',
  imports: [],
  templateUrl: './code-editor.html',
  styleUrl: './code-editor.scss',
  standalone: true,
})
export class CodeEditor implements AfterViewInit, OnDestroy {
  private monaco!: typeof import('monaco-editor');
  private editor!: Monaco.editor.IStandaloneCodeEditor;
  private models!: Record<'html' | 'css' | 'js', Monaco.editor.ITextModel>;
  private readonly codeRunnerStateService = inject(CodeRunnerStateService);

  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  activeTab: 'html' | 'css' | 'js' = 'html';

  ngAfterViewInit(): void {
    this.initEditor();
  }

  private stateEffect = effect(() => {
    const state = this.codeRunnerStateService.editableState();

    if (!this.models) return;

    if (this.models.html.getValue() !== state.html) {
      this.models.html.setValue(state.html);
    }

    if (this.models.css.getValue() !== state.css) {
      this.models.css.setValue(state.css);
    }

    if (this.models.js.getValue() !== state.js) {
      this.models.js.setValue(state.js);
    }
  });

  async initEditor() {
    if (this.editor) return;
    this.monaco = await import('monaco-editor');

    this.models = {
      html: this.monaco.editor.createModel(
        this.codeRunnerStateService.editableState().html,
        'html',
      ),
      css: this.monaco.editor.createModel(this.codeRunnerStateService.editableState().css, 'css'),
      js: this.monaco.editor.createModel(
        this.codeRunnerStateService.editableState().js,
        'javascript',
      ),
    };

    this.editor = this.monaco.editor.create(this.editorContainer.nativeElement, {
      model: this.models.html,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
    });

    this.editor.onDidChangeModelContent(() => {
      const value = this.editor.getValue();
      this.updateState(value);
    });
  }

  updateState(value: string) {
    if (this.activeTab === 'html') this.codeRunnerStateService.updateHtml(value);
    if (this.activeTab === 'css') this.codeRunnerStateService.updateCss(value);
    if (this.activeTab === 'js') this.codeRunnerStateService.updateJs(value);
  }

  changeTab(tab: 'html' | 'css' | 'js') {
    this.activeTab = tab;

    this.editor.setModel(this.models[tab]);
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    Object.values(this.models).forEach((model) => model.dispose());
  }
}
