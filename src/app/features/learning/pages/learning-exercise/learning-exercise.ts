import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@core/services/auth/auth-service';
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
export class LearningExercise implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly attemptService = inject(AttemptService);
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

  /** Los criterios con el resultado del último envío, o sin él si todavía no hay ninguno. */
  readonly criteria = computed<CriterionRow[]>(() => {
    const exercise = this.exercise();
    if (!exercise) return [];

    const results = this.outcome()?.results;

    // `resultsFor` devuelve un resultado por criterio y en el mismo orden, así que el índice
    // empareja sin necesidad de ninguna clave.
    return exercise.criteria.map((criterion, index) => ({
      description: criterion.description,
      passed: results ? (results[index]?.passed ?? false) : null,
    }));
  });

  ngOnInit() {
    void this.fetchExercise();
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

    try {
      const outcome = await panel.runValidation(code, exercise.criteria);

      // Se publica el resultado antes de guardar: si la escritura falla, el estudiante igual ve
      // en qué quedó su código, que es lo que estaba esperando.
      this.outcome.set(outcome);

      await this.attemptService.submitAttempt({
        exerciseId: exercise.id,
        code,
        passed: outcome.passed,
        results: outcome.results,
      });
    } catch (err) {
      this.submitError.set(
        'No se pudo registrar el intento. ' + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      this.submitting.set(false);
    }
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
        this.submitError.set(null);
      },
    });
  }

  private loadCode(code: CodeRunnerState) {
    this.codeRunner.updateHtml(code.html);
    this.codeRunner.updateCss(code.css);
    this.codeRunner.updateJs(code.js);
  }
}
