import { Component, effect, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { probesFor } from '@domain/code-runner/validation/criteria-probes';
import { hasPassed, resultsFor } from '@domain/code-runner/validation/criteria-results';
import { Probe, ProbeReport, ValidationOutcome } from '@domain/code-runner/validation/probe-model';
import { buildPreviewDocument } from '@domain/code-runner/validation/validation-harness';
import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';

/**
 * Cuanto se espera al informe del iframe antes de darlo por perdido.
 *
 * Sin este limite, un `while (true)` del estudiante dejaria la promesa de validacion colgada para
 * siempre, y con ella el boton de enviar.
 */
export const VALIDATION_TIMEOUT_MS = 3_000;

interface PendingValidation {
  runId: string;
  resolve: (report: ProbeReport | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

@Component({
  selector: 'app-preview-panel',
  imports: [],
  templateUrl: './preview-panel.html',
  styleUrl: './preview-panel.scss',
  standalone: true,
})
export class PreviewPanel {
  @ViewChild('host', { static: true })
  host!: ElementRef<HTMLElement>;

  private codeRunnerStateService = inject(CodeRunnerStateService);

  /** El iframe vigente. Cada render crea uno nuevo, ver {@link render}. */
  private frame: HTMLIFrameElement | null = null;
  private pending: PendingValidation | null = null;

  constructor() {
    effect(() => {
      const executed = this.codeRunnerStateService.executedState();
      // limpiar consola antes de render
      this.codeRunnerStateService.clearLogs();
      this.render(executed, null);
    });
  }

  /**
   * Escucha los mensajes del iframe.
   *
   * Vive aqui y no en el panel de consola porque `window:message` es global —lo recibe todo
   * mensaje de cualquier ventana— y el unico que puede filtrarlo es quien tiene la referencia al
   * iframe. Comparar `event.source` descarta de entrada lo que no venga de el.
   */
  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    if (!this.frame || event.source !== this.frame.contentWindow) return;
    if (!event.data || typeof event.data !== 'object') return;

    const { type, runId, payload } = event.data;
    if (!type) return;

    if (type === 'probe-report') {
      this.resolvePending(runId, event.data as ProbeReport);
      return;
    }

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

  /**
   * Ejecuta el codigo y comprueba los criterios contra el documento resultante.
   *
   * Vuelve a renderizar en lugar de sondear lo que ya hay en pantalla porque el `runId` tiene que
   * incrustarse al renderizar: enviarlo despues por `postMessage` dejaria que el codigo del
   * estudiante lo leyera y contestara antes con un informe inventado.
   */
  async runValidation(
    code: CodeRunnerState,
    criteria: ExerciseCriterion[],
  ): Promise<ValidationOutcome> {
    const runId = crypto.randomUUID();

    const report = await new Promise<ProbeReport | null>((resolve) => {
      // Una validacion anterior sin terminar se abandona: solo interesa la ultima.
      this.discardPending();

      this.pending = {
        runId,
        resolve,
        timer: setTimeout(() => this.resolvePending(runId, null), VALIDATION_TIMEOUT_MS),
      };

      this.codeRunnerStateService.clearLogs();
      this.render(code, probesFor(criteria), runId);
    });

    if (!report) {
      return {
        results: criteria.map(({ description }) => ({ description, passed: false })),
        passed: false,
        timedOut: true,
      };
    }

    const results = resultsFor(criteria, report.values, report.logs);
    return { results, passed: hasPassed(criteria, results), timedOut: false };
  }

  /**
   * Monta el codigo en un iframe **nuevo**.
   *
   * Reasignar `srcdoc` sobre el iframe existente no vale: dos asignaciones dentro de la misma
   * tarea se anulan entre si y no llega a cargar ninguna de las dos, de modo que un render seguido
   * de una validacion se quedaria en silencio. Crear el elemento cada vez fuerza la navegacion.
   *
   * Ademas, descartar el iframe anterior se lleva su contexto de ejecucion entero: temporizadores,
   * animaciones y bucles que hubiera dejado el codigo anterior no sobreviven, asi que cada
   * ejecucion parte de un documento limpio y da siempre el mismo resultado.
   */
  private render(code: CodeRunnerState, probes: Probe[] | null, runId = crypto.randomUUID()) {
    const host = this.host.nativeElement;
    host.replaceChildren();

    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');

    // El tamano lo pone el CSS (ver preview-panel.scss) y no un atributo. Con `height="400px"` el
    // iframe traia una altura propia que cada vista tenia que ganarle desde fuera; asi ocupa el
    // hueco que le den y quien lo monta decide cuanto es.

    // El documento solo se carga si el iframe ya esta en el arbol.
    host.appendChild(frame);
    frame.srcdoc = buildPreviewDocument(code, runId, probes);

    this.frame = frame;
  }

  /** Cierra la validacion en curso, con informe o sin el. Ignora informes de ejecuciones viejas. */
  private resolvePending(runId: string, report: ProbeReport | null) {
    const pending = this.pending;
    if (!pending || pending.runId !== runId) return;

    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(report);
  }

  private discardPending() {
    if (!this.pending) return;
    this.resolvePending(this.pending.runId, null);
  }
}
