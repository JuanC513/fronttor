import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ModuleService } from '@domain/learning/services/module-service';
import {
  LessonWithBlockCount,
  ModuleWithLessonCounts,
} from '@domain/learning/models/module-with-lesson-counts';
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

/**
 * Placeholder: todavía no existe la tabla de progreso del estudiante, así que el estado de cada
 * subtema se deriva de su posición dentro del recorrido completo (los primeros N cuentan como
 * completados, el siguiente como el que está cursando y el resto quedan bloqueados).
 *
 * Al conectar el progreso real solo hay que reemplazar `resolveStatus`: el resto de la vista ya
 * trabaja sobre `LessonStatus`.
 */
const TEMP_COMPLETED_LESSONS = 3;

@Component({
  selector: 'app-learning-modules',
  imports: [AccordionModule, ButtonModule, MessageModule, ProgressBarModule, SkeletonModule],
  templateUrl: './learning-modules.html',
  styleUrl: './learning-modules.scss',
})
export class LearningModules implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);

  modules = signal<ModuleWithLessonCounts[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  /** Id del tema abierto en el acordeón. `model` de PrimeNG, por eso se enlaza con `[(value)]`. */
  activePanel = signal<number | undefined>(undefined);

  skeletons = Array(4).fill(0);

  /**
   * Solo el contenido consumible: descarta los subtemas que todavía no tienen bloques y, en
   * cascada, los temas que se quedan sin subtemas. No muestra ítems que no puedes abrirse,
   * y "bloqueado" no funciona para esto.
   */
  private visibleModules = computed(() =>
    this.modules()
      .map((module) => ({
        ...module,
        lessons: (module.lessons ?? []).filter((lesson) => this.hasBlocks(lesson)),
      }))
      .filter((module) => module.lessons.length > 0),
  );

  /**
   * Vista derivada de los temas: numera los subtemas de corrido (a lo largo de todos los temas)
   * para poder asignarles un estado, y marca como bloqueado el tema cuyos subtemas lo están todos.
   *
   * Parte de `visibleModules` y no de `modules`: al filtrar antes de numerar, lo que está oculto no
   * consume posiciones del recorrido ni entra en el denominador del progreso.
   */
  moduleViews = computed<ModuleView[]>(() => {
    let position = 0;

    return this.visibleModules().map((module) => {
      const lessons: LessonView[] = module.lessons.map((lesson) => ({
        lesson,
        status: this.resolveStatus(position++),
      }));

      return {
        id: module.id,
        name: module.name,
        lessons,
        locked: lessons.every((item) => item.status === 'locked'),
      };
    });
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
      const data = await this.moduleService.getLearningTree();
      this.modules.set(data);
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

  /**
   * Lleva al subtema en curso. Hoy ese subtema sale del placeholder de `resolveStatus`; cuando
   * exista el progreso real será el último que el estudiante haya abierto.
   */
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

  private hasBlocks(lesson: LessonWithBlockCount): boolean {
    return (lesson.blocks?.[0]?.count ?? 0) > 0;
  }

  /** Ver {@link TEMP_COMPLETED_LESSONS}: estado simulado mientras no haya progreso persistido. */
  private resolveStatus(position: number): LessonStatus {
    if (position < TEMP_COMPLETED_LESSONS) return 'completed';
    if (position === TEMP_COMPLETED_LESSONS) return 'in-progress';
    return 'locked';
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
