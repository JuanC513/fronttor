import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
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

/**
 * `available` es «se puede abrir y todavía no se ha abierto». Sin ese estado la vista llamaba «En
 * progreso» a subtemas que el estudiante no había tocado, porque solo miraba si el contenido estaba
 * disponible e ignoraba `visited`.
 */
export type LessonStatus = 'completed' | 'in-progress' | 'available' | 'locked';

/** Un subtema con su estado ya resuelto, listo para la tarjeta. */
export interface LessonView {
  /** El subtema. */
  lesson: Lesson;

  /** Si está completado, disponible o bloqueado. */
  status: LessonStatus;
}

/** Un tema con sus subtemas, que es como se agrupa el recorrido. */
export interface ModuleView {
  /** Id del tema. */
  id: number;

  /** Nombre del tema. */
  name: string;

  /** Sus subtemas, en orden. */
  lessons: LessonView[];

  /** Cierto cuando ninguno de sus subtemas se puede abrir todavía. */
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
  private readonly authService = inject(AuthService);
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
      if (!state?.content) return 'locked';
      return state.visited ? 'in-progress' : 'available';
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

  /**
   * Tema y subtema donde se quedó el estudiante, para el botón "Continuar aprendiendo".
   *
   * Primero lo que dejó a medias; si no hay nada a medias, lo primero que puede empezar. El orden
   * importa: retomar un subtema abierto es más útil que mandarlo a uno nuevo.
   */
  private currentLesson = computed(() => {
    const views = this.moduleViews();

    for (const status of ['in-progress', 'available'] as const) {
      for (const module of views) {
        const found = module.lessons.find((item) => item.status === status);
        if (found) return { moduleId: module.id, lessonId: found.lesson.id };
      }
    }
    return null;
  });

  canResume = computed(() => this.currentLesson() !== null);

  ngOnInit() {
    this.fetchModules();
  }

  async fetchModules() {
    // El progreso va pedido por usuario a mano: la RLS de `lesson_progress` deja ver también el de
    // los demás a quien tenga rol de profesor, y esta vista la abre la misma cuenta.
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error.set('No se pudo identificar la sesión. Vuelve a iniciar sesión.');
      this.loading.set(false);
      return;
    }

    try {
      // En paralelo: son dos lecturas independientes y la vista necesita las dos para pintar un
      // solo estado coherente.
      const [data, progress] = await Promise.all([
        this.moduleService.getLearningTree(),
        this.progressService.getForStudent(userId),
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
      case 'available':
        return 'Disponible';
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
      case 'available':
        return 'pi pi-circle';
      case 'locked':
        return 'pi pi-lock';
    }
  }

  /**
   * Abre el tema donde el estudiante va a continuar; si ya lo completó todo, el primero abierto.
   *
   * Sale de `currentLesson` para que el acordeón y el botón "Continuar aprendiendo" no puedan
   * apuntar a temas distintos.
   */
  private resolveInitialPanel(): number | undefined {
    const current = this.currentLesson();
    if (current) return current.moduleId;

    return this.moduleViews().find((module) => !module.locked)?.id;
  }
}
