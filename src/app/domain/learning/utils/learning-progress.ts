import { LessonWithBlockCount, ModuleWithLessonCounts } from '../models/module-with-lesson-counts';
import { LessonProgress } from '../models/lesson-progress-model';

/**
 * Qué puede hacer el estudiante en cada punto del recorrido.
 *
 * DENTRO de un tema el desbloqueo va por dos caminos separados, y eso es deliberado:
 *
 * - **El contenido** de un subtema se abre en cuanto se ha ABIERTO el anterior. Leer no debería
 *   quedar detenido por un ejercicio atascado.
 * - **Los ejercicios** de un subtema se abren cuando el anterior está COMPLETADO, que según
 *   `recompute_lesson_progress` significa haber aprobado todos sus ejercicios publicados.
 *
 * Como completar exige haber abierto, la disponibilidad de ejercicios es siempre un subconjunto de
 * la del contenido: nunca se puede practicar un subtema que todavía no se puede leer. Ese
 * invariante es lo que hace coherentes los dos caminos, y está cubierto por una prueba.
 *
 * ENTRE temas la regla es una sola y es dura: el primer subtema de un tema no se abre —ni para leer
 * ni para practicar— hasta que TODOS los subtemas del tema anterior están completados.
 *
 * La diferencia de trato tiene un motivo. Dentro de un tema, poder seguir leyendo mientras un
 * ejercicio se resiste es una ayuda: el subtema siguiente suele ser justo lo que falta por
 * entender. Pero aplicar eso también entre temas dejaba el candado en nada, porque bastaba con
 * entrar y salir de cada subtema en orden, sin resolver un solo ejercicio, para abrir el curso
 * entero. Un tema es la unidad que se da por vista, así que pasar de tema sí exige haberlo hecho.
 *
 * Todo aquí es puro: recibe lo que ya se leyó de la base y no habla con nadie. Las reglas de
 * visibilidad de lo publicado viven aparte, en `publication-state.ts`; esto es lo que ocurre
 * DESPUÉS, cuando ya se sabe qué existe y hay que decidir a qué llega cada estudiante.
 */

/** Un subtema del recorrido, con el tema al que pertenece. */
/**
 * Un subtema dentro del recorrido lineal, con su tema a cuestas.
 *
 * El recorrido se aplana para poder preguntar «cuál es el siguiente» sin tener que saltar de tema
 * en tema; por eso cada entrada arrastra su `moduleId`.
 */
export interface TrackLesson {
  /** El subtema, con el recuento de bloques que decide si cuenta. */
  lesson: LessonWithBlockCount;

  /** Tema al que pertenece, para poder armar la ruta. */
  moduleId: number;
}

/** Qué puede hacer el estudiante con un subtema concreto, ya resuelto en cuatro banderas. */
export interface LessonAvailability {
  /** Si se puede abrir el subtema y leer sus bloques. */
  content: boolean;
  /** Si se pueden intentar sus ejercicios. */
  exercises: boolean;
  /** Si ya lo completó, según la base. */
  completed: boolean;
  /** Si lo ha abierto alguna vez: existe su fila de progreso. */
  visited: boolean;
}

/** Estado de un ejercicio concreto para un estudiante concreto. */
export type ExerciseProgressStatus = 'passed' | 'new' | 'pending' | 'locked';

/**
 * Los subtemas consumibles, aplanados y en orden de curso.
 *
 * Descarta los que todavía no tienen bloques publicados, y con ellos los temas que se quedan sin
 * ninguno. Un subtema vacío no se muestra como «bloqueado» porque no lo está: es que no hay nada
 * que leer, y prometerlo para más adelante sería mentir.
 *
 * El orden es el que trae la consulta, que ya viene ordenada por `order` en los dos niveles. De
 * aquí sale la secuencia sobre la que se encadena todo el desbloqueo.
 */
export function orderedLessons(modules: ModuleWithLessonCounts[]): TrackLesson[] {
  return modules.flatMap((module) =>
    (module.lessons ?? [])
      .filter((lesson) => (lesson.blocks?.[0]?.count ?? 0) > 0)
      .map((lesson) => ({ lesson, moduleId: module.id })),
  );
}

/**
 * Qué tiene abierto el estudiante en cada subtema del recorrido.
 *
 * El primer subtema está siempre disponible por los dos caminos: sin esa excepción nadie podría
 * empezar nunca, porque todo lo demás depende de algo anterior.
 */
export function lessonAvailability(
  lessons: TrackLesson[],
  progress: LessonProgress[],
): Map<number, LessonAvailability> {
  const byLesson = new Map(progress.map((row) => [row.lesson_id, row]));
  const availability = new Map<number, LessonAvailability>();
  const isCompleted = (lessonId: number) => byLesson.get(lessonId)?.status === 'completed';

  // Los subtemas de cada tema, para poder preguntar si un tema entero está completado. Se construye
  // sobre `lessons`, ya filtrado, de modo que un subtema sin bloques no puede retener a nadie.
  const byModule = new Map<number, number[]>();
  lessons.forEach(({ lesson, moduleId }) => {
    byModule.set(moduleId, [...(byModule.get(moduleId) ?? []), lesson.id]);
  });

  lessons.forEach((item, index) => {
    const previous = index === 0 ? null : lessons[index - 1];

    // La puerta entre temas. `null` significa «este subtema no abre tema», y entonces deciden las
    // reglas de abajo; un booleano manda sobre ambas, porque mientras el tema anterior no esté
    // terminado aquí no se entra ni a leer ni a practicar.
    const gate =
      previous !== null && previous.moduleId !== item.moduleId
        ? (byModule.get(previous.moduleId) ?? []).every(isCompleted)
        : null;

    const previousProgress = previous === null ? null : byLesson.get(previous.lesson.id);
    const own = byLesson.get(item.lesson.id);

    availability.set(item.lesson.id, {
      content: index === 0 || (gate ?? !!previousProgress),
      exercises: index === 0 || (gate ?? previousProgress?.status === 'completed'),
      completed: own?.status === 'completed',
      visited: !!own,
    });
  });

  return availability;
}

/**
 * Estado de un ejercicio, dado si el estudiante lo aprobó y cómo está su subtema.
 *
 * El caso que merece explicación es `new`. No se deduce de ninguna fecha, y no podría: como
 * `update_exercise` no toca ninguna marca de tiempo, un ejercicio escrito en borrador hace meses y
 * publicado hoy conserva un `created_at` viejo.
 *
 * Sale de la propia regla de completado. Si el subtema está completado es porque en ese momento
 * TODOS sus ejercicios publicados tenían un intento aprobado; por tanto uno que siga sin aprobar
 * solo puede haber aparecido después. Es exacto, y deja de serlo en cuanto lo apruebe.
 */
export function exerciseStatus(
  passed: boolean,
  lesson: Pick<LessonAvailability, 'exercises' | 'completed'>,
): ExerciseProgressStatus {
  if (passed) return 'passed';
  if (lesson.completed) return 'new';
  if (!lesson.exercises) return 'locked';
  return 'pending';
}

/**
 * Cuántos ejercicios de un subtema están aprobados sobre el total publicado.
 *
 * Es el mismo cociente que mira `recompute_lesson_progress` para decidir el completado, así que la
 * barra llena y la marca de completado no pueden discrepar. Un subtema sin ejercicios devuelve
 * `total: 0`, que la base considera completado con solo abrirlo.
 */
export function lessonExerciseProgress(statuses: ExerciseProgressStatus[]): {
  passed: number;
  total: number;
  percent: number;
} {
  const total = statuses.length;
  const passed = statuses.filter((status) => status === 'passed').length;

  return { passed, total, percent: total === 0 ? 100 : Math.round((passed / total) * 100) };
}
