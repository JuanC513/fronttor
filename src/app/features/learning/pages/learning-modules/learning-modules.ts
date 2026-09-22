import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { lessonAvailability, orderedLessons } from '@domain/learning/utils/learning-progress';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { Lesson } from '@domain/learning/models/lesson-model';

export type LessonStatus = 'completed' | 'in-progress' | 'locked';

export interface LessonView {
  lesson: Lesson;
  status: LessonStatus;
}

export interface ModuleView {
  id: number;
  name: string;
  lessons: LessonView[];
  locked: boolean;
}

@Component({
  selector: 'app-learning-modules',
  imports: [AccordionModule, ButtonModule, MessageModule, ProgressBarModule, SkeletonModule],
  templateUrl: './learning-modules.html',
  styleUrl: './learning-modules.scss',
})
export class LearningModules implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);
  private readonly progressService = inject(ProgressService);

  modules = signal<ModuleWithLessonCounts[]>([]);
  /** Filas de `lesson_progress` del estudiante. Distinto de `progress`, que es el porcentaje. */
  lessonProgress = signal<LessonProgress[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  /** Id del tema abierto en el acordeón. `model` de PrimeNG, por eso se enlaza con `[(value)]`. */
  activePanel = signal<number | undefined>(undefined);

  skeletons = Array(4).fill(0);

  /**
   * Vista derivada de los temas, con el estado real de cada subtema.
   *
   * La secuencia sale de `orderedLessons`, que descarta lo que todavía no tiene bloques: un
   * subtema vacío no se muestra como bloqueado porque no lo está, es que no hay nada que leer. Y
   * al descartarlo antes de encadenar, tampoco ocupa sitio en el recorrido ni entra en el
   * denominador del progreso.
   *
   * Aquí solo se mira la disponibilidad del CONTENIDO. La de los ejercicios es más estricta y
   * vive en la otra vista; las dos salen de la misma función.
   */
  moduleViews = computed<ModuleView[]>(() => {
    const lessons = orderedLessons(this.modules());
    const availability = lessonAvailability(lessons, this.lessonProgress());

    const statusOf = (lessonId: number): LessonStatus => {
      const state = availability.get(lessonId);
      if (state?.completed) return 'completed';
      return state?.content ? 'in-progress' : 'locked';
    };

    return this.modules()
      .map((module) => {
        const views: LessonView[] = lessons
          .filter((item) => item.moduleId === module.id)
          .map(({ lesson }) => ({ lesson, status: statusOf(lesson.id) }));

        return {
          id: module.id,
          name: module.name,
          lessons: views,
          locked: views.every((item) => item.status === 'locked'),
        };
      })
      .filter((module) => module.lessons.length > 0);
  });

  /** Porcentaje de subtemas completados sobre el total del curso. */
  progress = computed(() => {
    const lessons = this.moduleViews().flatMap((module) => module.lessons);
    if (!lessons.length) return 0;

    const completed = lessons.filter((item) => item.status === 'completed').length;
    return Math.round((completed / lessons.length) * 100);
  });

  /** Tema y subtema donde se quedó el estudiante, para el botón "Continuar aprendiendo". */
  private currentLesson = computed(() => {
    for (const module of this.moduleViews()) {
      const current = module.lessons.find((item) => item.status === 'in-progress');
      if (current) return { moduleId: module.id, lessonId: current.lesson.id };
    }
    return null;
  });

  canResume = computed(() => this.currentLesson() !== null);

  ngOnInit() {
    this.fetchModules();
  }

  async fetchModules() {
    try {
      // En paralelo: son dos lecturas independientes y la vista necesita las dos para pintar un
      // solo estado coherente.
      const [data, progress] = await Promise.all([
        this.moduleService.getLearningTree(),
        this.progressService.getMyProgress(),
      ]);

      this.modules.set(data);
      this.lessonProgress.set(progress);
      this.activePanel.set(this.resolveInitialPanel());
    } catch (err) {
      this.error.set('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  onLessonClick(moduleId: number, item: LessonView) {
    if (item.status === 'locked') return;
    this.router.navigate([`learning/modules/${moduleId}/lessons/${item.lesson.id}`]);
  }

  /** Lleva al primer subtema disponible que todavía no está completado. */
  onResumeLearning() {
    const current = this.currentLesson();
    if (!current) return;
    this.router.navigate([`learning/modules/${current.moduleId}/lessons/${current.lessonId}`]);
  }

  statusLabel(status: LessonStatus): string {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in-progress':
        return 'En progreso';
      case 'locked':
        return 'Bloqueado';
    }
  }

  statusIcon(status: LessonStatus): string {
    switch (status) {
      case 'completed':
        return 'pi pi-check-circle';
      case 'in-progress':
        return 'pi pi-play-circle';
      case 'locked':
        return 'pi pi-lock';
    }
  }

  /** Abre el tema en curso; si no hay ninguno, el primero que no esté bloqueado. */
  private resolveInitialPanel(): number | undefined {
    const views = this.moduleViews();
    const current = views.find((module) =>
      module.lessons.some((item) => item.status === 'in-progress'),
    );
    return (current ?? views.find((module) => !module.locked))?.id;
  }
}
