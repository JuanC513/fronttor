import { Component, HostListener, inject } from '@angular/core';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

@Component({
  selector: 'app-console-panel',
  imports: [],
  templateUrl: './console-panel.html',
  styleUrl: './console-panel.scss',
  standalone: true,
})
export class ConsolePanel {
  private readonly codeRunnerStateService: CodeRunnerStateService = inject(CodeRunnerStateService);
  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;

    const { type, payload } = event.data || {};

    if (!type) return;

    if (type === 'log' || type === 'info' || type === 'warn') {
      this.codeRunnerStateService.addLog(payload.join(' '));
    }

    if (type === 'error') {
      this.codeRunnerStateService.addLog('❌ ' + payload.join(' '));
    }

    if (type === 'runtime-error') {
      this.codeRunnerStateService.addLog('🔥 ERROR: ' + payload.message);
    }
  }

  getLogs() {
    return this.codeRunnerStateService.logs();
  }
}
