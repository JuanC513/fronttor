import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@core/services/auth/auth-service';
import { FeedbackCriterion, FeedbackHint } from '@domain/ai/models/generate-feedback-model';
import { AiService } from '@domain/ai/services/ai-service';
import { resolveHintFocus } from '@domain/ai/utils/feedback-focus';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { ValidationOutcome } from '@domain/code-runner/validation/probe-model';
import { ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import { StudentExerciseDetail } from '@domain/learning/models/student-exercise-detail';
import { AttemptDraft, AttemptService } from '@domain/learning/services/attempt-service';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { CodeEditor } from '@shared/components/code-editor/code-editor';
import { ConsolePanel } from '@shared/components/console-panel/console-panel';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';

/** Mismas etiquetas que el resto de la aplicación: la dificultad se lee igual en todos lados. */
const DIFFICULTY_LABEL: Record<ExerciseDifficulty, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
};

/** Una fila de la lista de criterios, ya cruzada con el resultado del último envío. */
export interface CriterionRow {
  description: string;
  /** `null` mientras no se haya enviado nada: todavía no se sabe. */
  passed: boolean | null;
  /** Si es el criterio que la pista de la IA señala. */
  focused: boolean;
}

/** El código con el que nace un ejercicio, antes de que el estudiante lo toque. */
function starterOf(exercise: StudentExerciseDetail): CodeRunnerState {
  return {
    html: exercise.starter_html,
    css: exercise.starter_css,
    js: exercise.starter_js,
  };
}

/**
 * Donde el estudiante resuelve un ejercicio.
 *
 * Es la primera vista que estrena la cadena completa: ejecuta el código, lo compara con los
 * criterios y registra el intento, que es lo que hace avanzar el progreso del subtema. Hasta ahora
 * `exercise_attempts` no tenía quien la escribiera y el recorrido solo avanzaba por los subtemas
 * sin ejercicios.
 *
 * El motor no se reimplementa: `PreviewPanel.runValidation` ya renderiza, sondea y compara, y es
 * el mismo que usa el formulario del profesor para comprobar que sus criterios están bien
 * escritos. Por eso el panel se pide con `viewChild` en vez de inyectarse: la validación necesita
 * el iframe montado.
 */
@Component({
  selector: 'app-learning-exercise',
  imports: [
    ButtonModule,
    CodeEditor,
    ConfirmPopupModule,
    ConsolePanel,
    MarkdownRenderer,
    MessageModule,
    PreviewPanel,
    RouterLink,
    SkeletonModule,
    TagModule,
  ],
  templateUrl: './learning-exercise.html',
  styleUrl: './learning-exercise.scss',
  providers: [ConfirmationService, CodeRunnerStateService],
})
export class LearningExercise implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly attemptService = inject(AttemptService);
  private readonly aiService = inject(AiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly codeRunner = inject(CodeRunnerStateService);

  private readonly previewPanel = viewChild(PreviewPanel);

  /**
   * El botón al que se ancla la confirmación de reinicio.
   *
   * El `read` no sobra: la referencia apunta a un `p-button` y sin él Angular devolvería la
   * instancia del componente, que no tiene `nativeElement`. Es el mismo fallo silencioso que ya
   * dejó un popover anclado en la esquina de la pantalla.
   */
  private readonly resetAnchor = viewChild('resetAnchor', { read: ElementRef });

  readonly exercise = signal<StudentExerciseDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * El envío anterior que se retomó al abrir, si lo había.
   *
   * Solo sirve para avisar de que el editor no trae el código inicial. Se descarta en cuanto el
   * estudiante reinicia o vuelve a enviar: a partir de ahí el código en pantalla es suyo de esta
   * sesión, y seguir diciendo «retomamos tu último envío» sería falso.
   */
  readonly draft = signal<AttemptDraft | null>(null);

  /** Resultado del último envío. `null` mientras no se haya enviado nada. */
  readonly outcome = signal<ValidationOutcome | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  /**
   * El código tal y como se envió.
   *
   * No se le pide la ayuda sobre `code()`, que es lo que hay en el editor ahora mismo: entre
   * enviar y pedir ayuda el estudiante puede haber seguido escribiendo, y entonces la pista
   * hablaría de un código distinto del que produjo los criterios en rojo que tiene delante.
   */
  private readonly submittedCode = signal<CodeRunnerState | null>(null);

  /**
   * El id con el que quedó registrado ese envío.
   *
   * Es lo que permite archivar la pista en el intento correcto en vez de en «el más reciente»:
   * mientras el modelo piensa, el estudiante puede haber enviado otro.
   */
  private readonly submittedAttemptId = signal<number | null>(null);

  /** La pista de esta sesión. La del envío anterior, si la hubo, llega por `draft()`. */
  readonly hint = signal<FeedbackHint | null>(null);
  readonly askingHelp = signal(false);
  readonly helpError = signal<string | null>(null);
  private helpController: AbortController | null = null;

  /** El código del editor. Vive en el servicio porque es también lo que alimenta al iframe. */
  readonly code = this.codeRunner.editableState;

  contentSkeletons = Array(4).fill(0);

  /**
   * Si el ejercicio está aprobado.
   *
   * Basta un intento aprobado alguna vez, aquí y en la base: `recompute_lesson_progress` cuenta
   * ejercicios con **algún** intento aprobado, así que seguir editando después de aprobar no
   * desaprueba nada. La vista dice lo mismo que la base para no contradecirla.
   */
  readonly passed = computed(() => !!this.exercise()?.passed || !!this.outcome()?.passed);

  /**
   * Un ejercicio sin criterios no se puede aprobar: `hasPassed` exige que haya al menos uno.
   *
   * El formulario del profesor impide publicarlo así, pero la comprobación se queda porque el
   * coste es nulo y la alternativa es un estudiante intentándolo sin que nada pueda salir bien.
   */
  readonly unsolvable = computed(() => this.exercise()?.criteria.length === 0);

  /**
   * El aviso del último envío: un solo mensaje cuyo tono y texto cambian.
   *
   * Se calcula aquí en vez de ramificar con `@if`/`@else` en la plantilla por un motivo concreto:
   * el `p-message` de PrimeNG se anima al aparecer y al destruirse, y al cambiar de rama Angular
   * destruye una vista y crea otra. El resultado observado era el peor posible —el mensaje viejo
   * («todavía no cumple») quedaba visible y el nuevo («¡correcto!») nacía con altura cero—, es
   * decir, se le decía al estudiante que había fallado justo cuando acababa de aprobar.
   *
   * Con un único elemento cuyas entradas cambian no hay vista que destruir, y por tanto tampoco
   * animación que se solape.
   */
  readonly resultMessage = computed<{
    severity: 'success' | 'warn' | 'error';
    text: string;
  } | null>(() => {
    const result = this.outcome();
    if (!result) return null;

    // Agotar el tiempo va primero: todos los criterios figuran como no cumplidos, pero no es que
    // el código estuviera mal, es que nunca llegó a contestar.
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

  /**
   * Los criterios y su estado, en la forma que entiende el modelo.
   *
   * Sirve para dos cosas a la vez, y por eso vive aquí: es lo que viaja en la petición de ayuda y
   * es contra lo que se valida el criterio que el modelo señala. Si fueran dos listas distintas,
   * el índice de la respuesta podría interpretarse contra una numeración que no es la que se envió.
   */
  private readonly feedbackCriteria = computed<FeedbackCriterion[]>(() => {
    const exercise = this.exercise();
    if (!exercise) return [];

    const results = this.outcome()?.results;

    return exercise.criteria.map((criterion, index) => ({
      description: criterion.description,
      passed: results?.[index]?.passed ?? false,
    }));
  });

  /** A qué criterio apunta la pista, ya validado. `null` si a ninguno que merezca resaltarse. */
  readonly hintFocus = computed(() => resolveHintFocus(this.hint(), this.feedbackCriteria()));

  /** Los criterios con el resultado del último envío, o sin él si todavía no hay ninguno. */
  readonly criteria = computed<CriterionRow[]>(() => {
    const exercise = this.exercise();
    if (!exercise) return [];

    const results = this.outcome()?.results;
    const focus = this.hintFocus();

    // `resultsFor` devuelve un resultado por criterio y en el mismo orden, así que el índice
    // empareja sin necesidad de ninguna clave.
    return exercise.criteria.map((criterion, index) => ({
      description: criterion.description,
      passed: results ? (results[index]?.passed ?? false) : null,
      focused: index === focus,
    }));
  });

  /** Si tiene sentido ofrecer ayuda: hay un envío y no aprobó. */
  readonly canAskHelp = computed(() => {
    const result = this.outcome();
    if (!result || result.passed) return false;

    // Una pista por envío. Sin esto, cada clic es otra llamada al modelo sobre el MISMO código:
    // gasta cuota —que es el recurso escaso— y devuelve consejos que pueden contradecirse entre
    // sí sobre algo que no ha cambiado. Para pedir otra hay que volver a enviar, que es cuando de
    // verdad hay algo nuevo que mirar.
    //
    // Se mira la pista y no solo si existe la respuesta: si el modelo contestó en blanco no hay
    // nada que enseñar, así que el botón sigue disponible para reintentar. Un error tampoco la
    // fija, de modo que un 503 deja volver a intentarlo.
    return !this.hint()?.pista;
  });

  /**
   * La ayuda que se muestra, venga de esta sesión o del envío anterior.
   *
   * Se distinguen porque no son lo mismo: una habla del código que el estudiante acaba de enviar,
   * la otra de uno que mandó otro día. Presentarlas igual haría que la segunda pareciera recién
   * salida del modelo.
   */
  readonly help = computed<{ text: string; fromPreviousAttempt: boolean } | null>(() => {
    const fresh = this.hint();
    if (fresh?.pista) return { text: fresh.pista, fromPreviousAttempt: false };

    const previous = this.draft()?.feedback;
    if (previous) return { text: previous, fromPreviousAttempt: true };

    return null;
  });

  ngOnInit() {
    void this.fetchExercise();
  }

  /** Si el estudiante se va mientras el tutor piensa, esa respuesta ya no le sirve a nadie. */
  ngOnDestroy(): void {
    this.helpController?.abort();
    this.helpController = null;
  }

  async fetchExercise() {
    const id = Number(this.route.snapshot.paramMap.get('exerciseId'));
    const userId = this.authService.getCurrentUser()?.id;

    if (!Number.isInteger(id)) {
      this.error.set('El ejercicio indicado no es válido.');
      this.loading.set(false);
      return;
    }

    if (!userId) {
      this.error.set('No se pudo identificar la sesión. Vuelve a iniciar sesión.');
      this.loading.set(false);
      return;
    }

    try {
      // Las dos lecturas son independientes —qué se pide y qué mandé yo la última vez—, así que
      // van a la vez. Si el ejercicio no existe, la segunda simplemente no devuelve nada.
      const [exercise, draft] = await Promise.all([
        this.exerciseService.getForStudent(id, userId),
        this.attemptService.getLastAttempt(id, userId),
      ]);

      this.exercise.set(exercise);
      this.draft.set(draft);

      // El último envío manda sobre el código inicial: si el estudiante ya trabajó aquí, empezar
      // de cero otra vez le borraría el trabajo cada vez que sale de la vista.
      this.loadCode(draft ? draft.code : starterOf(exercise));
    } catch {
      // Se da el mismo mensaje para "no existe" y "no está publicado": desde fuera son el mismo
      // caso, y distinguirlos solo diría que el ejercicio existe en borrador.
      this.error.set('Este ejercicio no está disponible.');
    } finally {
      this.loading.set(false);
    }
  }

  difficultyLabel(difficulty: ExerciseDifficulty): string {
    return DIFFICULTY_LABEL[difficulty] ?? difficulty;
  }

  onCodeChange(state: CodeRunnerState) {
    this.codeRunner.updateHtml(state.html);
    this.codeRunner.updateCss(state.css);
    this.codeRunner.updateJs(state.js);
  }

  /**
   * Comprueba el código contra los criterios y deja constancia del intento.
   *
   * Una sola acción y no "probar" y "enviar" por separado: el modo automático del runner ya
   * repinta la vista previa mientras se escribe, así que el estudiante no necesita pedir permiso
   * para ver su resultado. Y la tabla está pensada para acumular todos los envíos —es lo que
   * después permite hablar de su progreso—, así que registrar solo algunos la empobrecería.
   */
  async submit() {
    const exercise = this.exercise();
    const panel = this.previewPanel();

    if (!exercise || !panel || this.submitting()) return;

    // Se congela el código aquí: es el que se valida y el que se guarda, y entre una cosa y otra
    // el estudiante puede seguir escribiendo.
    const code = { ...this.code() };

    this.submitting.set(true);
    this.submitError.set(null);
    // Desde este envío el código en pantalla es de esta sesión, no el que se retomó al abrir.
    this.draft.set(null);
    // Y la ayuda anterior hablaba del código anterior: dejarla sería señalar criterios de otro
    // envío. Se cancela también la que estuviera en camino, por la misma razón.
    this.clearHelp();
    this.submittedCode.set(code);
    this.submittedAttemptId.set(null);

    try {
      const outcome = await panel.runValidation(code, exercise.criteria);

      // Se publica el resultado antes de guardar: si la escritura falla, el estudiante igual ve
      // en qué quedó su código, que es lo que estaba esperando.
      this.outcome.set(outcome);

      this.submittedAttemptId.set(
        await this.attemptService.submitAttempt({
          exerciseId: exercise.id,
          code,
          passed: outcome.passed,
          results: outcome.results,
        }),
      );
    } catch (err) {
      this.submitError.set(
        'No se pudo registrar el intento. ' + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Pide al modelo una pista sobre el envío que acaba de fallar.
   *
   * Es una acción del estudiante y no algo automático tras cada fallo: los criterios en rojo ya le
   * dicen qué falta, son exactos y no cuestan nada, así que la IA solo entra cuando decide que se
   * ha atascado. Eso ahorra cuota —que es el recurso escaso aquí— y, sobre todo, no le quita la
   * ocasión de resolverlo por su cuenta a quien iba a hacerlo.
   *
   * Se ofrece también cuando el envío agotó el tiempo: ahí no hay criterios que comentar, pero un
   * bucle que no termina es justo lo que un tutor detectaría de un vistazo.
   */
  async askForHelp() {
    const exercise = this.exercise();
    const result = this.outcome();
    const code = this.submittedCode();

    if (!exercise || !result || result.passed || !code || this.askingHelp()) return;

    // Si el intento no llegó a registrarse la pista no tiene dónde archivarse, pero sí se puede
    // pedir: al estudiante le sirve igual.
    const attemptId = this.submittedAttemptId();

    const controller = new AbortController();
    this.helpController?.abort();
    this.helpController = controller;
    this.askingHelp.set(true);
    this.helpError.set(null);

    try {
      const hint = await this.aiService.generateFeedback(
        {
          enunciado: exercise.statement,
          html: code.html,
          css: code.css,
          js: code.js,
          criterios: this.feedbackCriteria(),
          agotoTiempo: result.timedOut,
          exerciseId: exercise.id,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      this.hint.set(hint);

      if (attemptId !== null) {
        await this.saveHint(attemptId, hint.pista);
      }
    } catch (err) {
      // Abortar es una decisión del propio estudiante, no un fallo que enseñarle.
      if (controller.signal.aborted) return;
      this.helpError.set(err instanceof Error ? err.message : String(err));
    } finally {
      // Solo la petición vigente limpia el estado: si otra la reemplazó, la que termina tarde no
      // debe apagar el indicador de la nueva.
      if (this.helpController === controller) {
        this.helpController = null;
        this.askingHelp.set(false);
      }
    }
  }

  /**
   * Archiva la pista contra el intento.
   *
   * Un fallo aquí **no** se le enseña al estudiante, y es deliberado: la pista ya está en pantalla,
   * que es lo que pidió. Lo único que se pierde es volver a verla al reabrir el ejercicio, y no hay
   * nada que pueda hacer al respecto; un mensaje de error junto a una ayuda que sí llegó solo
   * conseguiría que pareciera que algo salió mal.
   */
  private async saveHint(attemptId: number, pista: string) {
    try {
      await this.attemptService.setFeedback(attemptId, pista);
    } catch (err) {
      console.error('No se pudo guardar la retroalimentación del intento', err);
    }
  }

  /** Deja la vista sin ayuda y sin peticiones en vuelo. */
  private clearHelp() {
    this.helpController?.abort();
    this.helpController = null;
    this.askingHelp.set(false);
    this.hint.set(null);
    this.helpError.set(null);
  }

  /**
   * Devuelve el código inicial del ejercicio.
   *
   * Sigue volviendo al `starter` y no al último envío aunque ahora sea este el que se carga: el
   * botón existe justo para deshacer el propio trabajo, así que restaurar el envío anterior no
   * sería reiniciar nada. El envío no se pierde —queda en `exercise_attempts`—, solo deja de estar
   * en pantalla.
   */
  onReset() {
    const exercise = this.exercise();
    if (!exercise) return;

    this.confirmationService.confirm({
      target: this.resetAnchor()?.nativeElement,
      message: 'Se descartará tu código y volverá el que traía el ejercicio.',
      icon: 'pi pi-refresh',
      acceptLabel: 'Reiniciar',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { variant: 'outlined' },
      accept: () => {
        this.loadCode(starterOf(exercise));
        this.draft.set(null);
        this.outcome.set(null);
        this.submittedCode.set(null);
        this.submittedAttemptId.set(null);
        this.submitError.set(null);
        this.clearHelp();
      },
    });
  }

  private loadCode(code: CodeRunnerState) {
    this.codeRunner.updateHtml(code.html);
    this.codeRunner.updateCss(code.css);
    this.codeRunner.updateJs(code.js);
  }
}
