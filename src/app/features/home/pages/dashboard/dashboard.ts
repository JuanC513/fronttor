import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { DIFFICULTY_LABEL, ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import { StudentExercise } from '@domain/learning/models/student-exercise';
import {
  SIN_ACTIVIDAD,
  TutorActivity,
  TutorActivityService,
} from '@domain/ai/services/tutor-activity-service';
import { ExerciseAttemptSummary, AttemptService } from '@domain/learning/services/attempt-service';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';
import { lessonAvailability, orderedLessons } from '@domain/learning/utils/learning-progress';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

/** Cuántos ejercicios se listan como atascados. Más que esto deja de orientar y empieza a agobiar. */
const MAX_ATASCADOS = 3;

/**
 * En qué punto del recorrido está el estudiante, que es lo que decide el discurso de la tarjeta
 * principal. Son los cuatro estados posibles, y el que más se va a ver es `empezar`.
 */
export type RecorridoEstado = 'empezar' | 'continuar' | 'completado' | 'sin-contenido';

/** El subtema al que lleva la tarjeta principal. */
export interface SiguientePaso {
  /** Tema al que pertenece, para armar la ruta. */
  moduleId: number;

  /** Subtema al que lleva el botón. */
  lessonId: number;

  /** Nombre del subtema, que es lo que se lee en la tarjeta. */
  nombre: string;
}

/** Un ejercicio intentado y nunca aprobado. */
export interface Atasco {
  /** Ejercicio donde se quedó, para enlazar directo. */
  exerciseId: number;

  /** Nombre del ejercicio. */
  nombre: string;

  /** Cuántas veces lo ha enviado sin aprobarlo. */
  intentos: number;
}

/** Una barra del progreso por tema. */
export interface TemaProgreso {
  /** Id del tema. */
  id: number;

  /** Nombre del tema. */
  nombre: string;

  /** Subtemas completados. */
  completados: number;

  /** Subtemas que tiene el tema. */
  total: number;

  /** `completados` sobre `total`, ya redondeado. */
  porcentaje: number;
  /** Ningún subtema suyo se puede abrir todavía. */
  bloqueado: boolean;
}

/** El ejercicio que le toca resolver ahora. */
export interface SiguienteEjercicio {
  /** Id del ejercicio, para enlazar. */
  id: number;

  /** Nombre del ejercicio. */
  nombre: string;

  /** Dificultad, para la etiqueta de color. */
  dificultad: ExerciseDifficulty;
}

/**
 * La pantalla de aterrizaje.
 *
 * Su trabajo es que el estudiante sepa qué hacer a continuación, y que el sistema demuestre que lo
 * está mirando. Para navegar ya está la barra lateral.
 *
 * **Todo se calcula con las mismas funciones que la vista de Contenido** —`orderedLessons` y
 * `lessonAvailability`—, y eso no es ahorro: es lo que hace imposible que las dos pantallas se
 * contradigan. La alternativa era `get_student_context()`, que agrega lo mismo en una sola llamada
 * pero cuenta *todos* los subtemas publicados en vez de solo los que tienen contenido que leer; con
 * los datos de hoy Inicio diría «1 de 20» y Contenido «1 de 3», a un clic de distancia.
 */
@Component({
  selector: 'app-dashboard',
  imports: [ButtonModule, MessageModule, RouterLink, SkeletonModule, TagModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly moduleService = inject(ModuleService);
  private readonly progressService = inject(ProgressService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly attemptService = inject(AttemptService);
  private readonly tutorActivityService = inject(TutorActivityService);

  readonly isTeacher = toSignal(this.authService.isTeacher$, { initialValue: false });

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly modules = signal<ModuleWithLessonCounts[]>([]);
  private readonly lessonProgress = signal<LessonProgress[]>([]);
  private readonly exercises = signal<StudentExercise[]>([]);
  private readonly attempts = signal<Map<number, ExerciseAttemptSummary>>(new Map());
  readonly tutor = signal<TutorActivity>(SIN_ACTIVIDAD);

  /** El recorrido consumible, ya aplanado y en orden, con su disponibilidad. */
  private readonly recorrido = computed(() => {
    const lessons = orderedLessons(this.modules());
    return { lessons, availability: lessonAvailability(lessons, this.lessonProgress()) };
  });

  readonly subtemas = computed(() => {
    const { lessons, availability } = this.recorrido();
    const completados = lessons.filter(
      (item) => availability.get(item.lesson.id)?.completed,
    ).length;

    return { completados, total: lessons.length };
  });

  readonly ejercicios = computed(() => {
    const lista = this.exercises();
    return { aprobados: lista.filter((item) => item.passed).length, total: lista.length };
  });

  readonly porcentaje = computed(() => {
    const { completados, total } = this.subtemas();
    return total === 0 ? 0 : Math.round((completados / total) * 100);
  });

  /**
   * A dónde lleva la tarjeta principal: lo empezado antes que lo nuevo.
   *
   * Es la misma elección que hace «Continuar aprendiendo» en Contenido. Si el estudiante dejó algo a
   * medias, mandarlo a un subtema nuevo sería peor consejo que devolverlo a lo que ya abrió.
   */
  readonly siguientePaso = computed<SiguientePaso | null>(() => {
    const { lessons, availability } = this.recorrido();

    const empezado = lessons.find((item) => {
      const estado = availability.get(item.lesson.id);
      return estado?.visited && !estado.completed;
    });

    const disponible = lessons.find((item) => {
      const estado = availability.get(item.lesson.id);
      return estado?.content && !estado.completed;
    });

    const elegido = empezado ?? disponible;
    if (!elegido) return null;

    return {
      moduleId: elegido.moduleId,
      lessonId: elegido.lesson.id,
      nombre: elegido.lesson.name,
    };
  });

  readonly estado = computed<RecorridoEstado>(() => {
    if (this.subtemas().total === 0) return 'sin-contenido';
    if (!this.siguientePaso()) return 'completado';

    return this.lessonProgress().length === 0 ? 'empezar' : 'continuar';
  });

  /**
   * Una barra por tema, que es lo que de verdad llena la pantalla cuando el curso tiene contenido.
   *
   * Sale de agrupar lo que ya está calculado, sin una lectura más. Un tema sin subtemas consumibles
   * no aparece: `orderedLessons` los descarta antes, y prometerlo para más adelante sería mentir.
   */
  readonly temas = computed<TemaProgreso[]>(() => {
    const { lessons, availability } = this.recorrido();
    const nombres = new Map(this.modules().map((module) => [module.id, module.name]));
    const porTema = new Map<number, { completados: number; total: number; abiertos: number }>();

    for (const item of lessons) {
      const acumulado = porTema.get(item.moduleId) ?? { completados: 0, total: 0, abiertos: 0 };
      const estado = availability.get(item.lesson.id);

      acumulado.total += 1;
      if (estado?.completed) acumulado.completados += 1;
      if (estado?.content) acumulado.abiertos += 1;

      porTema.set(item.moduleId, acumulado);
    }

    return [...porTema].map(([id, { completados, total, abiertos }]) => ({
      id,
      nombre: nombres.get(id) ?? '',
      completados,
      total,
      porcentaje: total === 0 ? 0 : Math.round((completados / total) * 100),
      // La misma regla que la vista de Contenido: bloqueado es «ninguno se puede abrir».
      bloqueado: abiertos === 0,
    }));
  });

  /**
   * Las comprobaciones superadas en el último intento de cada ejercicio.
   *
   * Es crédito parcial, y arregla algo que se ve hoy: quien ha intentado el único ejercicio y no lo
   * ha aprobado lee «0 de 1», que no distingue entre no haberlo intentado y haberse quedado a un
   * criterio. Solo cuentan los ejercicios que ha intentado: los demás no dicen nada de él.
   */
  readonly comprobaciones = computed(() => {
    let superadas = 0;
    let total = 0;

    for (const { ultimoResultado } of this.attempts().values()) {
      superadas += ultimoResultado.filter((criterio) => criterio.passed).length;
      total += ultimoResultado.length;
    }

    return { superadas, total };
  });

  /**
   * El ejercicio que le toca: el primero en orden de curso con los ejercicios abiertos y sin
   * aprobar.
   *
   * El orden lo da el recorrido, no el `order` del ejercicio: dentro de un subtema manda su propio
   * orden, pero entre subtemas manda la secuencia del curso.
   */
  readonly siguienteEjercicio = computed<SiguienteEjercicio | null>(() => {
    const { lessons, availability } = this.recorrido();
    const porSubtema = new Map<number, StudentExercise[]>();

    for (const ejercicio of this.exercises()) {
      porSubtema.set(ejercicio.lesson_id, [
        ...(porSubtema.get(ejercicio.lesson_id) ?? []),
        ejercicio,
      ]);
    }

    for (const item of lessons) {
      if (!availability.get(item.lesson.id)?.exercises) continue;

      const pendiente = (porSubtema.get(item.lesson.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .find((ejercicio) => !ejercicio.passed);

      if (pendiente) {
        return { id: pendiente.id, nombre: pendiente.name, dificultad: pendiente.difficulty };
      }
    }

    return null;
  });

  /** Si ha usado el tutor alguna vez. Sin uso la tarjeta invita, en vez de esconderse. */
  readonly usoElTutor = computed(() => {
    const { preguntas, pistas, practicas } = this.tutor();
    return preguntas + pistas + practicas > 0;
  });

  /**
   * Dónde se está atascando: ejercicios que ha intentado y nunca ha aprobado.
   *
   * `passed` sale de `getPublishedForStudent`, que ya lo resuelve por usuario; aquí solo se añade
   * cuántas veces lo ha intentado. Sin intentos no hay atasco, solo un ejercicio sin empezar.
   */
  readonly atascos = computed<Atasco[]>(() => {
    const resumen = this.attempts();

    return this.exercises()
      .filter((item) => !item.passed && (resumen.get(item.id)?.intentos ?? 0) > 0)
      .map((item) => ({
        exerciseId: item.id,
        nombre: item.name,
        intentos: resumen.get(item.id)?.intentos ?? 0,
      }))
      .sort((a, b) => b.intentos - a.intentos)
      .slice(0, MAX_ATASCADOS);
  });

  ngOnInit(): void {
    void this.fetchAll();
  }

  dificultadLabel(dificultad: ExerciseDifficulty): string {
    return DIFFICULTY_LABEL[dificultad];
  }

  /** Lleva al subtema que propone la tarjeta principal. */
  irAlSiguiente(): void {
    const paso = this.siguientePaso();
    if (!paso) return;

    void this.router.navigate(['/learning/modules', paso.moduleId, 'lessons', paso.lessonId]);
  }

  irAPracticaLibre(): void {
    void this.router.navigate(['/playground']);
  }

  async fetchAll(): Promise<void> {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error.set('No se pudo identificar la sesión. Vuelve a iniciar sesión.');
      this.loading.set(false);
      return;
    }

    try {
      // Las lecturas son independientes y la pantalla necesita todas para pintar un solo estado
      // coherente: mostrarlas por separado daría una cifra antes que otra.
      //
      // La del tutor va con su propio `catch` y no tumba el panel. Es accesoria —el recorrido se
      // entiende sin ella— y es la única que puede faltar por una razón previsible: un entorno sin
      // la migración `20261001120000` aplicada. Perder la tarjeta es mejor que perder la pantalla.
      const [modules, progress, exercises, attempts, tutor] = await Promise.all([
        this.moduleService.getLearningTree(),
        this.progressService.getForStudent(userId),
        this.exerciseService.getPublishedForStudent(userId),
        this.attemptService.getAttemptSummary(userId),
        this.tutorActivityService.getMyActivity().catch((err: unknown) => {
          console.error('No se pudo leer la actividad del tutor', err);
          return SIN_ACTIVIDAD;
        }),
      ]);

      this.modules.set(modules);
      this.lessonProgress.set(progress);
      this.exercises.set(exercises);
      this.attempts.set(attempts);
      this.tutor.set(tutor);
    } catch (err) {
      this.error.set('No se pudo cargar tu panel. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }
}
