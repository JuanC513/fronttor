import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification-service';
import { ExerciseWithLesson } from '@domain/learning/models/exercise-with-lesson';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { PublicationStatus, resolveExerciseStatus } from '@domain/learning/utils/publication-state';
import { TeachingTabs } from '@features/teaching/components/teaching-tabs/teaching-tabs';
import { PublicationBadge } from '@shared/components/publication-badge/publication-badge';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { OrderListModule } from 'primeng/orderlist';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DIFFICULTY_LABEL, ExerciseDifficulty } from '@domain/learning/models/exercise-model';

@Component({
  selector: 'app-teaching-exercises',
  imports: [
    TeachingTabs,
    ButtonModule,
    FormsModule,
    MessageModule,
    OrderListModule,
    PublicationBadge,
    RouterOutlet,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './teaching-exercises.html',
  styleUrl: './teaching-exercises.scss',
})
export class TeachingExercises implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly exerciseService = inject(ExerciseService);
  private readonly notifications = inject(NotificationService);
  private readonly moduleService = inject(ModuleService);

  readonly exercises = signal<ExerciseWithLesson[]>([]);
  readonly modules = signal<ModuleWithLessons[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly skeletons = Array(5).fill(0);

  readonly selectedModuleId = signal<number | undefined>(undefined);
  readonly selectedLessonId = signal<number | undefined>(undefined);

  readonly isReordering = signal(false);
  readonly isSaving = signal(false);
  buffer: ExerciseWithLesson[] = [];

  readonly lessonOptions = computed(
    () => this.modules().find((module) => module.id === this.selectedModuleId())?.lessons ?? [],
  );

  readonly visibleExercises = computed(() => {
    const moduleId = this.selectedModuleId();
    const lessonId = this.selectedLessonId();

    return this.exercises().filter((exercise) => {
      if (lessonId) return exercise.lesson_id === lessonId;
      if (moduleId) return exercise.lessons?.module_id === moduleId;
      return true;
    });
  });

  /**
   * La posición de un ejercicio es única dentro de su subtema, así que reordenar una lista que
   * mezcla varios no significa nada: se verían varios «1» y guardar reescribiría posiciones de
   * subtemas distintos con los mismos números.
   */
  readonly canReorder = computed(
    () => !!this.selectedLessonId() && this.visibleExercises().length > 1,
  );

  constructor() {
    effect(() => {
      this.exerciseService.refreshTrigger();
      this.fetchExercises();
    });
  }

  ngOnInit(): void {
    this.fetchModules();

    // Llega así desde el botón "Ver ejercicios" del subtema seleccionado en Contenido.
    const lessonId = Number(this.activatedRoute.snapshot.queryParams['lessonId']);
    if (lessonId) this.selectedLessonId.set(lessonId);
  }

  private async fetchExercises(): Promise<void> {
    try {
      this.exercises.set(await this.exerciseService.getAllWithLesson());
      this.error.set(null);
    } catch (err) {
      this.error.set('No se pudieron cargar los ejercicios. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchModules(): Promise<void> {
    try {
      const modules = await this.moduleService.getAllWithLessons();
      this.modules.set(modules);

      // El tema del filtro se deduce del subtema que venga por la URL.
      const lessonId = this.selectedLessonId();
      if (!lessonId) return;

      const owner = modules.find((module) =>
        (module.lessons ?? []).some((lesson) => lesson.id === lessonId),
      );
      this.selectedModuleId.set(owner?.id);
    } catch (err) {
      this.error.set('No se pudieron cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  onModuleChange(): void {
    this.selectedLessonId.set(undefined);
    this.isReordering.set(false);
  }

  onLessonChange(): void {
    this.isReordering.set(false);
  }

  status(exercise: ExerciseWithLesson): PublicationStatus {
    const lesson = exercise.lessons;

    return resolveExerciseStatus({
      exercise,
      lesson: { ...lesson, order: 0 },
      module: { ...lesson.modules, order: 0 },
      siblingExercises: this.exercises().filter((item) => item.lesson_id === exercise.lesson_id),
    });
  }

  difficultyLabel(value: ExerciseDifficulty): string {
    return DIFFICULTY_LABEL[value] ?? value;
  }

  createExercise(): void {
    this.router.navigate(['teaching/exercises/new'], {
      queryParams: this.selectedLessonId() ? { lessonId: this.selectedLessonId() } : {},
    });
  }

  editExercise(id: number): void {
    this.router.navigate([`teaching/exercises/edit/${id}`]);
  }

  startReorder(): void {
    this.buffer = [...this.visibleExercises()];
    this.isReordering.set(true);
  }

  cancelReorder(): void {
    this.isReordering.set(false);
  }

  async saveOrder(): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.exerciseService.reorderAll(this.buffer.map((exercise) => exercise.id));
      this.isReordering.set(false);
      this.notifications.exito('Orden de los ejercicios guardado');
    } catch (err) {
      this.notifications.error(
        'No se pudo guardar el orden',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
