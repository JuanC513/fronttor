import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { AuthService } from '@core/services/auth/auth-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { ProgressService } from '@domain/learning/services/progress-service';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { StudentExercise } from '@domain/learning/models/student-exercise';
import { DIFFICULTY_LABEL, ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import {
  ExerciseProgressStatus,
  exerciseStatus,
  lessonAvailability,
  lessonExerciseProgress,
  orderedLessons,
} from '@domain/learning/utils/learning-progress';

export interface ExerciseView {
  exercise: StudentExercise;
  status: ExerciseProgressStatus;
}

export interface LessonExercisesView {
  lessonId: number;
  name: string;
  locked: boolean;
  completed: boolean;
  exercises: ExerciseView[];
  passed: number;
  total: number;
  percent: number;
}

export interface ModuleExercisesView {
  id: number;
  name: string;
  lessons: LessonExercisesView[];
  locked: boolean;
}

/**
 * Dónde el estudiante elige qué ejercicio hacer.
 *
 * Agrupa por subtema y no en una lista plana porque un ejercicio no significa nada fuera del suyo:
 * el desbloqueo, el progreso y el completado se definen todos por subtema. Filtrar, que es lo que
 * hace el panel del profesor, sirve para gestionar un catálogo; aquí lo que hay es un recorrido.
 */
@Component({
  selector: 'app-learning-exercises',
  imports: [AccordionModule, MessageModule, ProgressBarModule, SkeletonModule, TagModule],
  templateUrl: './learning-exercises.html',
  styleUrl: './learning-exercises.scss',
})
export class LearningExercises implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly moduleService = inject(ModuleService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly progressService = inject(ProgressService);

  modules = signal<ModuleWithLessonCounts[]>([]);
  exercises = signal<StudentExercise[]>([]);
  lessonProgress = signal<LessonProgress[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  /** Id del tema abierto en el acordeón. `model` de PrimeNG, por eso se enlaza con `[(value)]`. */
  activePanel = signal<number | undefined>(undefined);

  skeletons = Array(3).fill(0);

  /**
   * El recorrido entero con el estado de cada ejercicio.
   *
   * Las tres lecturas se cruzan aquí y no en el servidor porque cada una responde a una pregunta
   * distinta —qué contenido existe, qué ejercicios hay, qué he hecho yo— y solo la vista necesita
   * las tres a la vez.
   */
  moduleViews = computed<ModuleExercisesView[]>(() => {
    const lessons = orderedLessons(this.modules());
    const availability = lessonAvailability(lessons, this.lessonProgress());
    const byLesson = new Map<number, StudentExercise[]>();

    for (const exercise of this.exercises()) {
      byLesson.set(exercise.lesson_id, [...(byLesson.get(exercise.lesson_id) ?? []), exercise]);
    }

    return this.modules()
      .map((module) => {
        const views: LessonExercisesView[] = lessons
          .filter((item) => item.moduleId === module.id)
          .map(({ lesson }) => {
            const state = availability.get(lesson.id) ?? {
              content: false,
              exercises: false,
              completed: false,
              visited: false,
            };

            const exercises: ExerciseView[] = (byLesson.get(lesson.id) ?? []).map((exercise) => ({
              exercise,
              status: exerciseStatus(exercise.passed, state),
            }));

            const progress = lessonExerciseProgress(exercises.map((item) => item.status));

            return {
              lessonId: lesson.id,
              name: lesson.name,
              locked: !state.exercises,
              completed: state.completed,
              exercises,
              ...progress,
            };
          });

        return {
          id: module.id,
          name: module.name,
          lessons: views,
          locked: views.every((lesson) => lesson.locked),
        };
      })
      .filter((module) => module.lessons.length > 0);
  });

  /** Cuántos ejercicios del curso lleva aprobados, para la tarjeta de resumen. */
  summary = computed(() => {
    const lessons = this.moduleViews().flatMap((module) => module.lessons);
    const passed = lessons.reduce((total, lesson) => total + lesson.passed, 0);
    const total = lessons.reduce((sum, lesson) => sum + lesson.total, 0);

    return { passed, total, percent: total === 0 ? 0 : Math.round((passed / total) * 100) };
  });

  ngOnInit() {
    this.fetchAll();
  }

  async fetchAll() {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error.set('No se pudo identificar la sesión. Vuelve a iniciar sesión.');
      this.loading.set(false);
      return;
    }

    try {
      const [modules, exercises, progress] = await Promise.all([
        this.moduleService.getLearningTree(),
        this.exerciseService.getPublishedForStudent(userId),
        this.progressService.getForStudent(userId),
      ]);

      this.modules.set(modules);
      this.exercises.set(exercises);
      this.lessonProgress.set(progress);
      this.activePanel.set(this.resolveInitialPanel());
    } catch (err) {
      this.error.set('No se pudieron cargar los ejercicios. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Abre la vista de resolución.
   *
   * El bloqueo lo aplica el `disabled` del botón, no este método: es coherente con cómo lo hace la
   * vista de contenido, y deja claro que —igual que allí— es una barrera de interfaz. Entrar por
   * URL a un ejercicio bloqueado sigue funcionando.
   */
  openExercise(exerciseId: number) {
    void this.router.navigate(['/learning/exercises', exerciseId]);
  }

  difficultyLabel(difficulty: ExerciseDifficulty): string {
    return DIFFICULTY_LABEL[difficulty] ?? difficulty;
  }

  statusIcon(status: ExerciseProgressStatus): string {
    switch (status) {
      case 'passed':
        return 'pi pi-check-circle';
      case 'locked':
        return 'pi pi-lock';
      case 'new':
      case 'pending':
        return 'pi pi-circle';
    }
  }

  statusLabel(status: ExerciseProgressStatus): string {
    switch (status) {
      case 'passed':
        return 'Resuelto';
      case 'locked':
        return 'Bloqueado';
      case 'new':
      case 'pending':
        return 'Pendiente';
    }
  }

  /** Abre el primer tema con algo por hacer; si no hay ninguno, el primero desbloqueado. */
  private resolveInitialPanel(): number | undefined {
    const views = this.moduleViews();
    const pending = views.find((module) =>
      module.lessons.some((lesson) => !lesson.locked && lesson.passed < lesson.total),
    );

    return (pending ?? views.find((module) => !module.locked))?.id;
  }
}
