import { Component, computed, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { GeneratedPractice, PracticeRequest } from '@domain/ai/models/generate-practice-model';
import { AiService } from '@domain/ai/services/ai-service';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import {
  allSound,
  CriterionCheck,
  diagnoseCriteria,
} from '@domain/code-runner/validation/criteria-diagnosis';
import { ValidationOutcome } from '@domain/code-runner/validation/probe-model';
import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { DIFFICULTY_LABEL, ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import { RawCriterion, toCriterion } from '@domain/learning/utils/criterion-parsing';
import { ModuleService } from '@domain/learning/services/module-service';
import { CodeEditor } from '@shared/components/code-editor/code-editor';
import { ConsolePanel } from '@shared/components/console-panel/console-panel';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';

/**
 * Debe coincidir con MAX_INSTRUCCION_LENGTH en
 * supabase/functions/_shared/prompts/practice-prompt.ts.
 *
 * No se importa desde ahí: Angular no compila archivos fuera de `src/`. La sincronización la
 * garantiza `scripts/check-prompt-limits-sync.mjs`, que corre en cada commit.
 */
export const MAX_INSTRUCCION_LENGTH = 500;

/** En qué va la vista. `generando` cubre toda la espera, con `step` contando el detalle. */
type Phase = 'pedir' | 'generando' | 'resolver';

/** Los pasos de la espera. Son tres porque puede haber dos llamadas al modelo y dos validaciones. */
type GenerationStep = 'pidiendo' | 'comprobando' | 'reparando';

const STEP_MESSAGE: Record<GenerationStep, string> = {
  pidiendo: 'Preparando tu ejercicio…',
  comprobando: 'Comprobando que se pueda resolver…',
  reparando: 'Ajustando los criterios…',
};

/** Un subtema del curso, ya con el nombre de su módulo al lado. */
interface LessonOption {
  label: string;
  value: number;
  tema: string;
}

/** Un ejercicio generado, ya comprobado. Vive en memoria y muere con la vista. */
interface PracticeExerciseData {
  titulo: string;
  enunciado: string;
  criteria: ExerciseCriterion[];
  inicial: CodeRunnerState;
}

/** Una fila de la lista de comprobación, cruzada con el último resultado. */
export interface PracticeCriterionRow {
  description: string;
  /** `null` mientras no se haya comprobado nada. */
  passed: boolean | null;
}

const DIFFICULTY_OPTIONS: { label: string; value: ExerciseDifficulty }[] = (
  ['facil', 'media', 'dificil'] as ExerciseDifficulty[]
).map((value) => ({ label: DIFFICULTY_LABEL[value], value }));

function isCode(value: unknown): value is CodeRunnerState {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c['html'] === 'string' && typeof c['css'] === 'string' && typeof c['js'] === 'string'
  );
}

/** Lo que llega del modelo se valida antes de usarse, como cualquier otra entrada. */
function isGeneratedPractice(value: unknown): value is GeneratedPractice {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;

  return (
    typeof p['titulo'] === 'string' &&
    typeof p['enunciado'] === 'string' &&
    isCode(p['inicial']) &&
    isCode(p['solucion']) &&
    Array.isArray(p['criterios'])
  );
}

/**
 * Ejercicios de práctica que el estudiante se pide a sí mismo.
 *
 * Elige un subtema de su recorrido, dice qué quiere practicar, y recibe un ejercicio con enunciado
 * y criterios que resuelve en el mismo taller de Libre.
 *
 * **No se guarda nada**: ni fila en `exercises`, ni intento, ni progreso. Se pierde al salir. Es
 * práctica, no evaluación, y por eso no reutiliza `LearningExercise`, que está atada de arriba
 * abajo a que el ejercicio exista en la base —lee el id de la ruta, recupera el borrador del último
 * intento y registra cada envío—. Lo que sí comparten son los cuatro componentes del taller.
 *
 * ## Lo que de verdad hace esta vista
 *
 * Generar el ejercicio es una llamada. Lo difícil es **que se pueda resolver**. Cuando el profesor
 * genera uno con IA tiene un botón para probar los criterios y, sobre todo, puede arreglarlos. El
 * estudiante no puede hacer ninguna de las dos cosas: un criterio mal escrito se le presenta como
 * un ejercicio que no aprueba haga lo que haga. Por eso aquí la comprobación no es opcional, corre
 * sola antes de enseñarle nada, y si algo sale mal se repara o se descarta (ver `generate`).
 */
@Component({
  selector: 'app-practice-exercise',
  imports: [
    ButtonModule,
    CodeEditor,
    ConsolePanel,
    FormsModule,
    MarkdownRenderer,
    MessageModule,
    PreviewPanel,
    ProgressSpinnerModule,
    RouterLink,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './practice-exercise.html',
  styleUrl: './practice-exercise.scss',
  providers: [CodeRunnerStateService],
})
export class PracticeExercise implements OnInit, OnDestroy {
  private readonly aiService = inject(AiService);
  private readonly moduleService = inject(ModuleService);
  private readonly codeRunner = inject(CodeRunnerStateService);

  /**
   * El panel se pide con `viewChild` y no se inyecta porque la validación necesita el iframe
   * montado: `runValidation` renderiza dentro de él y espera a que las sondas contesten.
   */
  private readonly previewPanel = viewChild(PreviewPanel);

  readonly maxInstruccionLength = MAX_INSTRUCCION_LENGTH;
  readonly difficultyOptions = DIFFICULTY_OPTIONS;

  readonly phase = signal<Phase>('pedir');
  readonly step = signal<GenerationStep>('pidiendo');
  readonly error = signal<string | null>(null);
  readonly loadingTree = signal(true);

  readonly lessonGroups = signal<{ label: string; items: LessonOption[] }[]>([]);
  readonly lessonId = signal<number | null>(null);
  readonly instruction = signal('');
  readonly difficulty = signal<ExerciseDifficulty>('facil');

  readonly exercise = signal<PracticeExerciseData | null>(null);
  readonly outcome = signal<ValidationOutcome | null>(null);
  readonly checking = signal(false);

  /**
   * Cuántos criterios se quedaron por el camino.
   *
   * Se enseña, no se esconde: si el enunciado pide cinco cosas y la lista comprueba tres, el
   * estudiante merece saber por qué, en vez de pensar que la comprobación está rota.
   */
  readonly discarded = signal(0);

  /** El código del editor. Vive en el servicio porque es también lo que alimenta al iframe. */
  readonly code = this.codeRunner.editableState;

  private controller: AbortController | null = null;

  readonly stepMessage = computed(() => STEP_MESSAGE[this.step()]);

  readonly difficultyLabel = computed(() => DIFFICULTY_LABEL[this.difficulty()]);

  readonly canGenerate = computed(() => this.lessonId() !== null && this.phase() !== 'generando');

  /** Los criterios con el resultado de la última comprobación, o sin él si no ha habido ninguna. */
  readonly criteria = computed<PracticeCriterionRow[]>(() => {
    const exercise = this.exercise();
    if (!exercise) return [];

    const results = this.outcome()?.results;

    return exercise.criteria.map((criterion, index) => ({
      description: criterion.description,
      passed: results ? (results[index]?.passed ?? false) : null,
    }));
  });

  /**
   * Un solo mensaje cuyo tono y texto cambian, en vez de tres ramas en la plantilla.
   *
   * Es la misma decisión que en la vista de resolución y por el mismo motivo: el `p-message` de
   * PrimeNG se anima al aparecer y al destruirse, así que cambiar de rama dejaba el mensaje viejo
   * visible mientras el nuevo nacía con altura cero.
   */
  readonly resultMessage = computed<{
    severity: 'success' | 'warn' | 'error';
    text: string;
  } | null>(() => {
    const result = this.outcome();
    if (!result) return null;

    if (result.timedOut) {
      return {
        severity: 'warn',
        text: 'Tu código tardó demasiado en responder. Revisa si hay un bucle infinito.',
      };
    }

    if (result.passed) {
      return { severity: 'success', text: '¡Correcto! Cumple todos los criterios.' };
    }

    return {
      severity: 'error',
      text: 'Todavía no cumple todos los criterios. Revisa la lista de la izquierda.',
    };
  });

  ngOnInit(): void {
    void this.fetchTree();
  }

  /** Si el estudiante se va mientras el modelo trabaja, esa generación ya no le sirve a nadie. */
  ngOnDestroy(): void {
    this.controller?.abort();
    this.controller = null;
  }

  /**
   * Llena el desplegable con el árbol publicado del curso.
   *
   * Es el mismo `getLearningTree()` que pinta la vista de módulos, así que el estudiante solo puede
   * practicar sobre subtemas que existen y están publicados. Es también lo que pone el ejercicio a
   * su nivel: el modelo recibe un subtema real del currículo, no una frase suelta.
   */
  private async fetchTree(): Promise<void> {
    try {
      const modules = await this.moduleService.getLearningTree();

      this.lessonGroups.set(
        modules
          .filter((module) => module.lessons.length > 0)
          .map((module) => ({
            label: module.name,
            items: module.lessons.map((lesson) => ({
              label: lesson.name,
              value: lesson.id,
              tema: module.name,
            })),
          })),
      );
    } catch {
      this.error.set('No se pudo cargar el temario. Vuelve a intentarlo.');
    } finally {
      this.loadingTree.set(false);
    }
  }

  private selectedLesson(): LessonOption | null {
    const id = this.lessonId();
    if (id === null) return null;

    for (const group of this.lessonGroups()) {
      const found = group.items.find((item) => item.value === id);
      if (found) return found;
    }

    return null;
  }

  /**
   * Pide el ejercicio y no lo enseña hasta saber que se puede resolver.
   *
   * Tres pasos, y el segundo es el que justifica la vista entera:
   *
   * 1. Una llamada al modelo con el ejercicio completo.
   * 2. Se ejecutan sus criterios contra el código inicial y contra su propia solución, igual que
   *    hace el profesor a mano. `diagnoseCriteria` cruza las dos lecturas y detecta los dos fallos
   *    silenciosos: el criterio que ni la solución cumple, y el que el código inicial ya cumple.
   * 3. Si algo no está bien planteado, una única ronda de reparación con los veredictos en la mano.
   *    Se reparan los criterios y nunca el enunciado: el enunciado es lo que el estudiante pidió, y
   *    cambiarlo por debajo sería entregarle otro ejercicio.
   *
   * Lo que siga mal después de eso se descarta. Un ejercicio con menos comprobaciones sigue
   * sirviendo para practicar; uno imposible de aprobar, no.
   */
  async generate(): Promise<void> {
    const lesson = this.selectedLesson();
    if (!lesson || this.phase() === 'generando') return;

    const controller = new AbortController();
    this.controller?.abort();
    this.controller = controller;

    this.phase.set('generando');
    this.step.set('pidiendo');
    this.error.set(null);
    this.outcome.set(null);
    this.discarded.set(0);

    const base = {
      tema: lesson.tema,
      subtema: lesson.label,
      dificultad: this.difficulty(),
      instruccion: this.instruction().trim() || undefined,
    };

    try {
      const generated = await this.requestPractice({ modo: 'completo', ...base }, controller);

      if (!isGeneratedPractice(generated)) {
        throw new Error('El ejercicio llegó incompleto.');
      }

      let criteria = generated.criterios.map(toCriterion);

      this.step.set('comprobando');
      let checks = await this.checkCriteria(generated.inicial, generated.solucion, criteria);

      if (!allSound(checks)) {
        this.step.set('reparando');
        const repaired = await this.requestPractice(
          {
            modo: 'criterios',
            ...base,
            enunciado: generated.enunciado,
            inicial: generated.inicial,
            solucion: generated.solucion,
            diagnostico: criteria.map((criterio, index) => ({
              criterio,
              veredicto: checks[index].verdict,
            })),
          },
          controller,
        );

        // Lo que vuelve es la lista plana del esquema; se recorta igual que la primera vez.
        const rebuilt: RawCriterion[] = Array.isArray(repaired) ? (repaired as RawCriterion[]) : [];

        if (rebuilt.length) {
          criteria = rebuilt.map(toCriterion);
          this.step.set('comprobando');
          checks = await this.checkCriteria(generated.inicial, generated.solucion, criteria);
        }
      }

      const sound = criteria.filter((_, index) => checks[index]?.verdict === 'ok');

      if (!sound.length) {
        this.error.set(
          'El ejercicio no salió bien: sus comprobaciones no funcionaban. Prueba otra vez, o ' +
            'cambia lo que pediste.',
        );
        this.phase.set('pedir');
        return;
      }

      this.exercise.set({
        titulo: generated.titulo,
        enunciado: generated.enunciado,
        criteria: sound,
        inicial: generated.inicial,
      });
      this.discarded.set(criteria.length - sound.length);
      this.applyCode(generated.inicial);
      this.phase.set('resolver');
    } catch (err) {
      // Abandonar es una decisión del estudiante, no un fallo que haya que contarle.
      if (controller.signal.aborted) return;

      this.error.set(
        'No se pudo generar el ejercicio. ' + (err instanceof Error ? err.message : String(err)),
      );
      this.phase.set('pedir');
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  private async requestPractice(
    request: PracticeRequest,
    controller: AbortController,
  ): Promise<unknown> {
    const response = await this.aiService.generatePractice(request, controller.signal);
    return response.resultado;
  }

  /**
   * Ejecuta los criterios contra los dos códigos y cruza las lecturas.
   *
   * En serie y con la solución al final, igual que en el formulario del profesor: `runValidation`
   * abandona la validación pendiente al empezar otra, así que lanzarlas a la vez haría volver la
   * primera como agotada.
   */
  private async checkCriteria(
    inicial: CodeRunnerState,
    solucion: CodeRunnerState,
    criteria: ExerciseCriterion[],
  ): Promise<CriterionCheck[]> {
    const panel = this.previewPanel();
    if (!panel || !criteria.length) return [];

    const starter = await panel.runValidation(inicial, criteria);
    const solution = await panel.runValidation(solucion, criteria);

    return diagnoseCriteria(solution.results, starter.results);
  }

  /** Comprueba el código del estudiante. No registra nada: aquí no hay intento que guardar. */
  async check(): Promise<void> {
    const exercise = this.exercise();
    const panel = this.previewPanel();

    if (!exercise || !panel || this.checking()) return;

    this.checking.set(true);

    try {
      this.outcome.set(await panel.runValidation({ ...this.code() }, exercise.criteria));
    } finally {
      this.checking.set(false);
    }
  }

  /** Devuelve el editor al código con el que nació el ejercicio. */
  reset(): void {
    const exercise = this.exercise();
    if (!exercise) return;

    this.applyCode(exercise.inicial);
    this.outcome.set(null);
  }

  /** Vuelve a la fase de pedir. El ejercicio anterior se descarta: nunca hubo dónde guardarlo. */
  startOver(): void {
    this.controller?.abort();
    this.controller = null;

    this.exercise.set(null);
    this.outcome.set(null);
    this.discarded.set(0);
    this.error.set(null);
    this.applyCode({ html: '', css: '', js: '' });
    this.codeRunner.clearLogs();
    this.phase.set('pedir');
  }

  onCodeChange(state: CodeRunnerState): void {
    this.applyCode(state);
  }

  private applyCode(code: CodeRunnerState): void {
    this.codeRunner.updateHtml(code.html);
    this.codeRunner.updateCss(code.css);
    this.codeRunner.updateJs(code.js);
  }
}
