import { Component, inject } from '@angular/core';
import { CodeEditor } from '@shared/components/code-editor/code-editor';
import { ConsolePanel } from '@shared/components/console-panel/console-panel';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

@Component({
  selector: 'app-playground-page',
  imports: [CodeEditor, ConsolePanel, PreviewPanel],
  templateUrl: './playground-page.html',
  styleUrl: './playground-page.scss',
  standalone: true,
  providers: [CodeRunnerStateService],
})
export class PlaygroundPage {
  private readonly codeRunnerStateService = inject(CodeRunnerStateService);

  toggleMode() {
    const currentMode = this.getExecutionMode();
    this.codeRunnerStateService.setExecutionMode(currentMode === 'auto' ? 'manual' : 'auto');
  }

  getExecutionMode() {
    return this.codeRunnerStateService.executionMode();
  }

  run() {
    this.codeRunnerStateService.run();
  }
}
