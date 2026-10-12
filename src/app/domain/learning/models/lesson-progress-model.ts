/** Espejo del check de la columna `status`. Un subtema o esta en curso o esta completado. */
export type LessonProgressStatus = 'in_progress' | 'completed';

/**
 * Avance del estudiante en un subtema. Una fila por (user_id, lesson_id).
 *
 * Solo se escribe desde las RPC `submit_exercise_attempt` y
 * `mark_lesson_viewed`, que resuelven el usuario con `auth.uid()` del lado del
 * servidor; la RLS no concede escritura directa.
 */
export interface LessonProgress {
  /** Clave primaria en `public.lesson_progress`. */
  id: number;

  /** De quien es el avance. */
  user_id: string;

  /** Subtema al que corresponde. */
  lesson_id: number;

  /** En curso o completado. Lo que decide si el siguiente subtema se abre. */
  status: LessonProgressStatus;
  /**
   * Cuantos ejercicios tenia el subtema al completarlo. Hace permanente el
   * completado sin perder informacion: permite mostrar "hay N ejercicios
   * nuevos" comparando contra el total actual, sin volver a bloquear nada.
   */
  exercises_at_completion: number | null;

  /** Cuando se completo, o nulo si sigue en curso. */
  completed_at: string | null;

  /** Ultima escritura de la fila, en ISO 8601. */
  updated_at: string;
}
