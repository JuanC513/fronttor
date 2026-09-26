import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AiService } from '@domain/ai/services/ai-service';
import { ExerciseCode, ExercisePart } from '@domain/ai/models/generate-exercise-model';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import {
  allSound,
  CriterionCheck,
  diagnoseCriteria,
  VERDICT_MESSAGE,
} from '@domain/code-runner/validation/criteria-diagnosis';
import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import {
  Exercise,
  ExerciseDifficulty,
  ExerciseInput,
  ExerciseWithoutSolution,
} from '@domain/learning/models/exercise-model';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import {
  describeExerciseImpact,
  exercisePublicationBlock,
} from '@domain/learning/utils/publication-state';
import { CodeEditor } from '@shared/components/code-editor/code-editor';
import { FieldError } from '@shared/components/field-error/field-error';
import { MarkdownCheatsheet } from '@shared/components/markdown-cheatsheet/markdown-cheatsheet';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import {
  AiGeneratePanel,
  GenerateRequest,
} from '@features/teaching/components/ai-generate-panel/ai-generate-panel';
import { buildCriterionRow } from '@features/teaching/components/criterion-editor/criterion-row';
import { CriterionEditor } from '@features/teaching/components/criterion-editor/criterion-editor';
import { CriterionFormValue, toCriterion } from '@features/teaching/utils/criterion-fields';
import {
  deleteConfirmation,
  UNPUBLISH_INSTEAD,
} from '@features/teaching/utils/delete-confirmation';
import { publicationConfirmation } from '@shared/components/publication-field/publication-confirm';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';
import { PublicationField } from '@shared/components/publication-field/publication-field';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopup, ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';

/** Un enunciado es markdown, pero de un solo ejercicio: mucho más corto que un bloque. */
const MAX_STATEMENT_LENGTH = 5_000;

const EMPTY_CODE: CodeRunnerState = { html: '', css: '', js: '' };

type ConfirmKind = 'publication' | 'delete' | 'ai' | null;

@Component({
  selector: 'app-exercise-form-dialog',
  imports: [
    AiGeneratePanel,
    ButtonModule,
    CodeEditor,
    ConfirmPopupModule,
    CriterionEditor,
    DialogModule,
    FieldError,
    FloatLabelModule,
    InputTextModule,
    MarkdownCheatsheet,
    MarkdownRenderer,
    MessageModule,
    PreviewPanel,
    PublicationField,
    ReactiveFormsModule,
    SelectModule,
    TabsModule,
    TextareaModule,
  ],
  // `CodeRunnerStateService` es de instancia por componente: lo necesita el previsualizador
  // con el que se comprueban los criterios.
  providers: [ConfirmationService, CodeRunnerStateService],
  templateUrl: './exercise-form-dialog.html',
  styleUrl: './exercise-form-dialog.scss',
})
export class ExerciseFormDialog implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly exerciseService = inject(ExerciseService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aiService = inject(AiService);

  exerciseForm!: FormGroup;
  uiForm!: FormGroup;
  isEditForm!: boolean;

  readonly maxStatementLength = MAX_STATEMENT_LENGTH;
  readonly difficulties: { label: string; value: ExerciseDifficulty }[] = [
    { label: 'Fácil', value: 'facil' },
    { label: 'Media', value: 'media' },
    { label: 'Difícil', value: 'dificil' },
  ];

  readonly modulesList = signal<ModuleWithLessons[]>([]);
  private readonly lessonsSource = signal<Lesson[]>([]);
  readonly lessonsList = signal<Lesson[]>([]);

  /** El código vive en señales y no en el formulario: `CodeEditor` se enlaza con `[(value)]`. */
  readonly starterCode = signal<CodeRunnerState>({ ...EMPTY_CODE });
  readonly solutionCode = signal<CodeRunnerState>({ ...EMPTY_CODE });

  private readonly source = signal<Exercise['source']>('manual');

  /**
   * Los criterios tal como están ahora mismo en el formulario.
   *
   * Se refleja desde el `FormArray` en una señal para que el bloqueo de publicación reaccione en
   * cuanto se añade el primero, en vez de calcularse una sola vez al cargar.
   */
  private readonly criteriaValue = signal<CriterionFormValue[]>([]);
  private readonly criteria = computed(() => this.criteriaValue().map(toCriterion));

  /**
   * Sin solución escrita fallan todos los criterios, pero la culpa no es de ellos. Decir
   * «revisa los criterios» aquí mandaría a buscar un error donde no lo hay.
   */
  private readonly hasSolution = computed(() => {
    const { html, css, js } = this.solutionCode();
    return !!(html.trim() || css.trim() || js.trim());
  });

  /**
   * Lo mínimo que la IA necesita saber del ejercicio, reflejado desde el formulario.
   *
   * Va en una señal porque `getRawValue()` no lo es: leído dentro de un `computed` devuelve el
   * valor del momento en que se creó y no vuelve a recalcularse, así que el bloqueo se quedaba
   * puesto para siempre por más que se rellenara el nombre.
   */
  private readonly generationInputs = signal<{ lessonId: number | null; name: string }>({
    lessonId: null,
    name: '',
  });

  /**
   * Si el asistente de IA está desplegado.
   *
   * Uno solo para las cuatro pestañas y no uno por cada una: solo hay una visible a la vez, y
   * conservar el estado al cambiar de pestaña evita tener que volver a abrirlo cada vez que se
   * pasa de una parte a la siguiente.
   */
  readonly showAiPanel = signal(false);

  /** Qué parte se está generando ahora mismo, o `null` si ninguna. */
  readonly generatingPart = signal<ExercisePart | null>(null);
  readonly generationError = signal<string | null>(null);
  /** Controla la generación en curso, para poder abandonarla si el diálogo se cierra antes. */
  private generationController: AbortController | null = null;

  readonly checks = signal<CriterionCheck[] | null>(null);
  readonly isTesting = signal(false);
  readonly isSaving = signal(false);
  readonly testError = signal<string | null>(null);
  readonly verdictMessage = VERDICT_MESSAGE;

  private readonly saved = signal<Exercise | null>(null);
  private readonly siblings = signal<ExerciseWithoutSolution[]>([]);
  private readonly pendingPublished = signal(false);

  private readonly saveAnchor = viewChild<ElementRef<HTMLElement>>('saveAnchor');
  private readonly deleteAnchor = viewChild<ElementRef<HTMLElement>>('deleteAnchor');
  private readonly confirmPopup = viewChild(ConfirmPopup);
  private readonly previewPanel = viewChild(PreviewPanel);

  readonly isConfirming = computed(() => this.confirmPopup()?.computedVisible() ?? false);

  /**
   * Que confirmacion esta abierta, para que cada una resalte lo suyo.
   *
   * Basta con anotarla al abrirla, sin reiniciarla: solo se lee mientras el popup esta abierto, y
   * de eso ya se encarga `isConfirming`.
   */
  private readonly confirmKind = signal<ConfirmKind>(null);

  /** El aviso de publicacion se realza solo si el popup abierto es el suyo. */
  readonly highlightImpact = computed(
    () => this.isConfirming() && this.confirmKind() === 'publication',
  );

  /** Ocupa el hueco del aviso de publicacion mientras se pregunta por el borrado. */
  readonly deleteNotice = computed(() =>
    this.isConfirming() && this.confirmKind() === 'delete' ? this.deleteMessage() : null,
  );

  /**
   * Borrar arrastra los intentos que los estudiantes hayan hecho, por la clave foranea en cascada.
   * No hay forma de recuperarlos, de ahi que el aviso lo diga y ofrezca despublicar en su lugar.
   */
  private readonly deleteMessage = computed(() => {
    const exercise = this.saved();
    if (!exercise) return '';

    return (
      `Se borrará «${exercise.name}» de forma permanente, junto con los intentos que los ` +
      `estudiantes hayan hecho sobre él. ${UNPUBLISH_INSTEAD}`
    );
  });

  /** Sin criterios no se puede publicar: dejaría el subtema imposible de completar. */
  readonly publicationBlock = computed(() =>
    exercisePublicationBlock({ criteria: this.criteria() }),
  );

  readonly impact = computed(() => {
    const exercise = this.saved();
    if (!exercise) return null;

    const lesson = this.lessonsSource().find((item) => item.id === exercise.lesson_id);
    const module = this.modulesList().find((item) => item.id === lesson?.module_id);
    if (!lesson || !module) return null;

    return describeExerciseImpact(
      { exercise, lesson, module, siblingExercises: this.siblings() },
      this.pendingPublished(),
    );
  });

  get criteriaArray(): FormArray<FormGroup> {
    return this.exerciseForm.controls['criteria'] as FormArray<FormGroup>;
  }

  get isPublishedControl(): FormControl<boolean> {
    return this.exerciseForm.controls['is_published'] as FormControl<boolean>;
  }

  constructor() {
    // `emitEvent: false` para que habilitar el control no vuelva a disparar `valueChanges` y con
    // ello el ciclo entero.
    effect(() => {
      const blocked = this.publicationBlock();
      const control = this.isPublishedControl;
      if (!control) return;

      if (blocked && control.enabled) control.disable({ emitEvent: false });
      if (!blocked && control.disabled) control.enable({ emitEvent: false });
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.exerciseForm = this.formBuilder.group({
      name: [undefined, [Validators.required, Validators.maxLength(100)]],
      lesson_id: [{ value: undefined, disabled: !this.isEditForm }, Validators.required],
      statement: [undefined, [Validators.required, Validators.maxLength(MAX_STATEMENT_LENGTH)]],
      difficulty: ['media', Validators.required],
      // Nace inhabilitado: mientras no tenga criterios no se puede publicar.
      is_published: [{ value: false, disabled: true }],
      criteria: this.formBuilder.array<FormGroup>([]),
    });
    this.uiForm = this.formBuilder.group({
      module_id: [undefined, Validators.required],
    });

    this.isPublishedControl.valueChanges.subscribe((value) => this.pendingPublished.set(!!value));

    // `getRawValue` y no el valor emitido: `lesson_id` empieza inhabilitado al crear, y los
    // controles inhabilitados no aparecen en `valueChanges`.
    this.exerciseForm.valueChanges.subscribe(() => {
      const raw = this.exerciseForm.getRawValue();
      this.generationInputs.set({ lessonId: raw.lesson_id ?? null, name: raw.name ?? '' });
    });

    // Editar los criterios invalida cualquier comprobación anterior: lo que se vio ya no describe
    // lo que hay.
    this.criteriaArray.valueChanges.subscribe((value) => {
      this.criteriaValue.set(value as CriterionFormValue[]);
      this.checks.set(null);
      this.testError.set(null);
    });

    this.uiForm.get('module_id')?.valueChanges.subscribe((value) => {
      if (value) {
        this.lessonsList.set(this.lessonsSource().filter((lesson) => lesson.module_id === value));
        this.exerciseForm.get('lesson_id')?.enable();
      } else {
        this.lessonsList.set([]);
        this.exerciseForm.get('lesson_id')?.disable();
      }
    });

    await this.loadContext();

    if (id) {
      await this.loadExercise(Number(id));
    } else {
      const lessonId = Number(this.activatedRoute.snapshot.queryParams['lessonId']);
      if (lessonId) this.preselect(lessonId);
    }
  }

  private async loadContext(): Promise<void> {
    try {
      const [modules, lessons] = await Promise.all([
        this.moduleService.getAllWithLessons(),
        this.lessonService.getAll(),
      ]);
      this.modulesList.set(modules);
      this.lessonsSource.set(lessons);
      this.lessonsList.set(lessons);
    } catch (err) {
      console.error('No se pudo cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  private preselect(lessonId: number): void {
    const lesson = this.lessonsSource().find((item) => item.id === lessonId);
    if (!lesson) return;

    this.uiForm.patchValue({ module_id: lesson.module_id });
    this.exerciseForm.patchValue({ lesson_id: lessonId });
    this.generationInputs.set({ lessonId, name: this.exerciseForm.getRawValue().name ?? '' });
  }

  private async loadExercise(id: number): Promise<void> {
    try {
      const exercise = await this.exerciseService.getById(id);
      // Los hermanos hacen falta para saber si es el último publicado del subtema.
      const siblings = await this.exerciseService.getAllByLessonId(exercise.lesson_id);

      this.saved.set(exercise);
      this.siblings.set(siblings);
      this.source.set(exercise.source);

      for (const criterion of exercise.criteria ?? []) {
        this.criteriaArray.push(
          buildCriterionRow(this.formBuilder, this.destroyRef, criterion.type, criterion),
        );
      }
      this.pendingPublished.set(exercise.is_published);

      this.starterCode.set({
        html: exercise.starter_html,
        css: exercise.starter_css,
        js: exercise.starter_js,
      });
      this.solutionCode.set({
        html: exercise.solution_html,
        css: exercise.solution_css,
        js: exercise.solution_js,
      });

      const lesson = this.lessonsSource().find((item) => item.id === exercise.lesson_id);
      this.uiForm.patchValue({ module_id: lesson?.module_id });

      this.exerciseForm.patchValue({
        name: exercise.name,
        lesson_id: exercise.lesson_id,
        statement: exercise.statement,
        difficulty: exercise.difficulty,
        is_published: exercise.is_published,
      });
    } catch (err) {
      console.error('No se pudo cargar el ejercicio. Intenta de nuevo. ' + err);
    }
  }

  /**
   * La IA necesita al menos el tema, el subtema y el nombre para saber de qué va el ejercicio.
   */
  readonly generationBlock = computed(() => {
    const { lessonId, name } = this.generationInputs();
    if (!lessonId || !name.trim()) {
      return 'Selecciona un tema y un subtema, y escribe el nombre del ejercicio para poder generar.';
    }
    return null;
  });

  /**
   * Pide confirmación solo si esa parte ya tiene contenido.
   *
   * El aviso habla de **reemplazar por una versión ajustada** y no de perder lo escrito, porque
   * es lo que de verdad ocurre: lo que hay viaja en el contexto y la IA trabaja sobre ello.
   *
   * El popup se ancla al botón que lo abrió, no al de guardar: cae así sobre la parte que se va a
   * reemplazar —el panel está justo encima de ella— en vez de sobre el pie del diálogo, que en la
   * pestaña del enunciado queda encima de la vista previa, que es lo único que la IA no toca.
   */
  onGenerateClick(part: ExercisePart, { instruccion, target }: GenerateRequest): void {
    if (!this.hasContent(part)) {
      void this.generate(part, instruccion);
      return;
    }

    this.confirmKind.set('ai');
    this.confirmationService.confirm({
      target,
      message:
        part === 'criteria'
          ? 'Se reemplazará la lista de criterios por la que genere la IA.'
          : 'Se reemplazará por la versión que genere la IA a partir de lo que hay.',
      icon: 'pi pi-sparkles',
      acceptLabel: 'Generar',
      acceptButtonProps: { severity: 'primary' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { variant: 'outlined' },
      accept: () => void this.generate(part, instruccion),
    });
  }

  private hasContent(part: ExercisePart): boolean {
    const filled = (code: CodeRunnerState) =>
      !!(code.html.trim() || code.css.trim() || code.js.trim());

    switch (part) {
      case 'statement':
        return !!this.exerciseForm.getRawValue().statement?.trim();
      case 'starter':
        return filled(this.starterCode());
      case 'solution':
        return filled(this.solutionCode());
      case 'criteria':
        return this.criteriaArray.length > 0;
    }
  }

  toggleAiPanel(): void {
    this.showAiPanel.update((visible) => !visible);
    this.generationError.set(null);
  }

  private async generate(part: ExercisePart, instruccion: string): Promise<void> {
    const raw = this.exerciseForm.getRawValue();
    const lesson = this.lessonsSource().find((item) => item.id === raw.lesson_id);
    const module = this.modulesList().find((item) => item.id === lesson?.module_id);
    if (!lesson || !module) return;

    const controller = new AbortController();
    this.generationController = controller;
    this.generatingPart.set(part);
    this.generationError.set(null);

    try {
      const response = await this.aiService.generateExercisePart(
        {
          parte: part,
          tema: module.name,
          subtema: lesson.name,
          nombre: raw.name,
          dificultad: raw.difficulty,
          // El ejercicio entero viaja siempre, también la parte que se está generando: es lo que
          // permite ajustar en vez de reemplazar a ciegas.
          enunciado: raw.statement || undefined,
          inicial: this.starterCode(),
          solucion: this.solutionCode(),
          criterios: this.criteria(),
          instruccion: instruccion || undefined,
        },
        controller.signal,
      );

      this.apply(part, response);
    } catch (err) {
      if (controller.signal.aborted) return;
      this.generationError.set(err instanceof Error ? err.message : String(err));
    } finally {
      if (this.generationController === controller) {
        this.generationController = null;
        this.generatingPart.set(null);
      }
    }
  }

  /** Marca el ejercicio como asistido por IA en cuanto se genera cualquiera de sus partes. */
  private async apply(
    part: ExercisePart,
    response: { enunciado?: string; resultado?: unknown },
  ): Promise<void> {
    this.source.set('ia');

    if (part === 'statement') {
      this.exerciseForm.patchValue({ statement: response.enunciado ?? '' });
      return;
    }

    if (part === 'starter' || part === 'solution') {
      const code = response.resultado as ExerciseCode | undefined;
      if (!code) return;

      const state: CodeRunnerState = {
        html: code.html ?? '',
        css: code.css ?? '',
        js: code.js ?? '',
      };
      if (part === 'starter') this.starterCode.set(state);
      else this.solutionCode.set(state);
      return;
    }

    // Criterios: llegan planos y entran por el mismo camino que uno escrito a mano, así que
    // heredan el recorte por tipo y la validación de cada campo.
    const generated = (response.resultado as CriterionFormValue[] | undefined) ?? [];
    this.criteriaArray.clear();

    for (const criterion of generated) {
      this.criteriaArray.push(
        buildCriterionRow(
          this.formBuilder,
          this.destroyRef,
          criterion.type,
          toCriterion(criterion),
        ),
      );
    }

    // Comprobar en el acto es lo que cierra el círculo: un criterio puede venir bien formado y aun
    // así no cumplirse con la solución, y nadie iba a acordarse de pulsar Probar.
    await this.runChecks();
  }

  /**
   * Cerrar el diálogo navega fuera y destruye el componente, pero la petición a la Edge Function
   * no está atada a ese ciclo de vida.
   */
  ngOnDestroy(): void {
    this.generationController?.abort();
    this.generationController = null;
  }

  closeDialog(): void {
    this.router.navigate(['/teaching/exercises']);
  }

  /**
   * Comprueba los criterios contra el codigo inicial y contra la solucion, en ese orden.
   *
   * En serie y no a la vez: `runValidation` abandona la validacion pendiente al empezar otra, asi
   * que lanzarlas juntas haria volver la primera como agotada. Y la solucion se deja para el final
   * porque cada validacion vuelve a renderizar, de modo que la vista previa queda mostrando lo que
   * deberia verse bien.
   */
  async runChecks(): Promise<CriterionCheck[]> {
    const panel = this.previewPanel();
    const criteria = this.criteria();
    if (!panel || !criteria.length) return [];

    this.isTesting.set(true);
    this.testError.set(null);

    try {
      const starter = await panel.runValidation(this.starterCode(), criteria);
      const solution = await panel.runValidation(this.solutionCode(), criteria);

      if (starter.timedOut || solution.timedOut) {
        this.testError.set(
          'El código tardó demasiado en responder. Revisa si tiene un bucle que no termina.',
        );
      }

      const checks = diagnoseCriteria(solution.results, starter.results);
      this.checks.set(checks);
      return checks;
    } finally {
      this.isTesting.set(false);
    }
  }

  /**
   * Publicar exige que la solucion de referencia pase todos los criterios.
   *
   * Es el segundo cerrojo sobre el mismo fallo que bloquea el interruptor sin criterios: un
   * ejercicio publicado que nadie puede aprobar deja el subtema imposible de completar para todos,
   * sin que nada lo explique. El primero cubre "no tiene criterios"; este, "los tiene pero no
   * funcionan".
   */
  async onSubmit(): Promise<void> {
    if (this.exerciseForm.invalid || this.isSaving() || this.isTesting()) return;

    if (this.exerciseForm.getRawValue().is_published) {
      const checks = await this.runChecks();

      if (!allSound(checks)) {
        this.testError.set(
          this.testError() ??
            (this.hasSolution()
              ? 'No se puede publicar: revisa abajo los criterios que no están bien planteados.'
              : 'No se puede publicar sin solución de referencia: es el código con el que se ' +
                'comprueba que los criterios funcionan.'),
        );
        return;
      }
    }

    const impact = this.impact();
    if (!impact?.hides) {
      void this.save();
      return;
    }

    this.confirmKind.set('publication');
    this.confirmationService.confirm(
      publicationConfirmation(this.saveAnchor()?.nativeElement, () => void this.save()),
    );
  }

  onDelete(): void {
    const exercise = this.saved();
    if (!exercise) return;

    this.confirmKind.set('delete');
    this.confirmationService.confirm(
      deleteConfirmation(this.deleteAnchor()?.nativeElement, () => void this.remove(exercise.id)),
    );
  }

  private async remove(id: number): Promise<void> {
    await this.exerciseService.delete(id);
    this.closeDialog();
  }

  private async save(): Promise<void> {
    this.isSaving.set(true);
    const raw = this.exerciseForm.getRawValue();
    const starter = this.starterCode();
    const solution = this.solutionCode();

    const input: ExerciseInput = {
      lesson_id: raw.lesson_id,
      name: raw.name,
      statement: raw.statement,
      difficulty: raw.difficulty,
      starter_html: starter.html,
      starter_css: starter.css,
      starter_js: starter.js,
      solution_html: solution.html,
      solution_css: solution.css,
      solution_js: solution.js,
      criteria: this.criteria() as ExerciseCriterion[],
      source: this.source(),
      is_published: raw.is_published,
    };

    try {
      if (this.isEditForm) {
        const id = Number(this.activatedRoute.snapshot.paramMap.get('id'));
        await this.exerciseService.update(id, input);
      } else {
        await this.exerciseService.insert(input);
      }

      this.closeDialog();
    } finally {
      this.isSaving.set(false);
    }
  }
}
