import { ExerciseDifficulty } from './exercise-model';

/**
 * Un ejercicio publicado con lo único que la vista de selección necesita saber de él, más si el
 * estudiante ya lo tiene aprobado.
 *
 * No trae `statement`, ni el código inicial, ni los criterios: son campos grandes y esta vista
 * lista todos los ejercicios del curso a la vez. Los traerá la vista de resolución, que pide uno.
 */
export interface StudentExercise {
  id: number;
  lesson_id: number;
  name: string;
  difficulty: ExerciseDifficulty;
  order: number;
  /** Si existe al menos un intento aprobado suyo. Es la misma condición que usa la base. */
  passed: boolean;
}
