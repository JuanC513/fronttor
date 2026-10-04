export type LessonProgressStatus = 'in_progress' | 'completed';

/**
 * Avance del estudiante en un subtema. Una fila por (user_id, lesson_id).
 *
 * Solo se escribe desde las RPC `submit_exercise_attempt` y
 * `mark_lesson_viewed`, que resuelven el usuario con `auth.uid()` del lado del
 * servidor; la RLS no concede escritura directa.
 */
export interface LessonProgress {
  id: number;
  user_id: string;
  lesson_id: number;
  status: LessonProgressStatus;
  /**
   * Cuantos ejercicios tenia el subtema al completarlo. Hace permanente el
   * completado sin perder informacion: permite mostrar "hay N ejercicios
   * nuevos" comparando contra el total actual, sin volver a bloquear nada.
   */
  exercises_at_completion: number | null;
  completed_at: string | null;
  updated_at: string;
}
