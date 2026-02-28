import { Component, effect, ElementRef, inject, ViewChild } from '@angular/core';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

@Component({
  selector: 'app-preview-panel',
  imports: [],
  templateUrl: './preview-panel.html',
  styleUrl: './preview-panel.scss',
  standalone: true,
})
export class PreviewPanel {
  @ViewChild('iframe', { static: true })
  iframe!: ElementRef<HTMLIFrameElement>;

  private codeRunnerStateService = inject(CodeRunnerStateService);

  constructor() {
    effect(() => {
      const executed = this.codeRunnerStateService.executedState();
      // limpiar consola antes de render
      this.codeRunnerStateService.clearLogs();
      this.render(executed);
    });
  }

  private render(code: CodeRunnerState) {
    this.iframe.nativeElement.srcdoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${code.css}
      </style>
    </head>
    <body>

      ${code.html}

      <script>
        (function() {

          function sendToParent(type, payload) {
            parent.postMessage({ type, payload }, '*');
          }

          ['log', 'error', 'warn', 'info'].forEach(method => {
            console[method] = function(...args) {
              sendToParent(method, args);
            };
          });

          window.onerror = function(message, source, lineno, colno, error) {
            sendToParent('runtime-error', { message, lineno, colno });
            return true;
          };

          window.onunhandledrejection = function(event) {
            sendToParent('runtime-error', {
              message: event.reason?.message || event.reason
            });
            return true;
          };

          // Ejecutar JS del estudiante
          try {
            const userCode = ${JSON.stringify(code.js)};
            const fn = new Function(userCode);
            fn();
          } catch (error) {
            sendToParent('runtime-error', {
              message: error.message
            });
          }

        })();
      </script>

    </body>
    </html>
    `;
  }
}
