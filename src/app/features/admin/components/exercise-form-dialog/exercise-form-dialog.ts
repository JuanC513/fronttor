import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import {
  Exercise,
  ExerciseDifficulty,
  ExerciseInput,
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
import { deleteConfirmation, UNPUBLISH_INSTEAD } from '@features/admin/utils/delete-confirmation';
import { publicationConfirmation } from '@shared/components/publication-field/publication-confirm';
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

type ConfirmKind = 'publication' | 'delete' | null;

@Component({
  selector: 'app-exercise-form-dialog',
  imports: [
    ButtonModule,
    CodeEditor,
    ConfirmPopupModule,
    DialogModule,
    FieldError,
    FloatLabelModule,
    InputTextModule,
    MarkdownCheatsheet,
    MarkdownRenderer,
    MessageModule,
    PublicationField,
    ReactiveFormsModule,
    SelectModule,
    TabsModule,
    TextareaModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './exercise-form-dialog.html',
  styleUrl: './exercise-form-dialog.scss',
})
export class ExerciseFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly exerciseService = inject(ExerciseService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly confirmationService = inject(ConfirmationService);

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

  /** Los criterios se conservan tal cual; su edición llega en la siguiente entrega. */
  private readonly criteria = signal<Exercise['criteria']>([]);
  private readonly source = signal<Exercise['source']>('manual');

  private readonly saved = signal<Exercise | null>(null);
  private readonly siblings = signal<Exercise[]>([]);
  private readonly pendingPublished = signal(false);

  private readonly saveAnchor = viewChild<ElementRef<HTMLElement>>('saveAnchor');
  private readonly deleteAnchor = viewChild<ElementRef<HTMLElement>>('deleteAnchor');
  private readonly confirmPopup = viewChild(ConfirmPopup);

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

  get isPublishedControl(): FormControl<boolean> {
    return this.exerciseForm.controls['is_published'] as FormControl<boolean>;
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
    });
    this.uiForm = this.formBuilder.group({
      module_id: [undefined, Validators.required],
    });

    this.isPublishedControl.valueChanges.subscribe((value) => this.pendingPublished.set(!!value));

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
  }

  private async loadExercise(id: number): Promise<void> {
    try {
      const exercise = await this.exerciseService.getById(id);
      // Los hermanos hacen falta para saber si es el último publicado del subtema.
      const siblings = await this.exerciseService.getAllByLessonId(exercise.lesson_id);

      this.saved.set(exercise);
      this.siblings.set(siblings);
      this.criteria.set(exercise.criteria ?? []);
      this.source.set(exercise.source);
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

      // El bloqueo se aplica al control y no solo al mensaje: un control inhabilitado tampoco se
      // puede mover con el teclado.
      if (this.publicationBlock()) {
        this.isPublishedControl.disable();
      } else {
        this.isPublishedControl.enable();
      }
    } catch (err) {
      console.error('No se pudo cargar el ejercicio. Intenta de nuevo. ' + err);
    }
  }

  closeDialog(): void {
    this.router.navigate(['/admin/exercises']);
  }

  onSubmit(): void {
    if (this.exerciseForm.invalid) return;

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
      criteria: this.criteria(),
      source: this.source(),
      is_published: raw.is_published,
    };

    if (this.isEditForm) {
      const id = Number(this.activatedRoute.snapshot.paramMap.get('id'));
      await this.exerciseService.update(id, input);
    } else {
      await this.exerciseService.insert(input);
    }

    this.closeDialog();
  }
}
