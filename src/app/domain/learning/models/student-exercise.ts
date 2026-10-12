import { ExerciseDifficulty } from './exercise-model';

/**
 * Un ejercicio publicado con lo único que la vista de selección necesita saber de él, más si el
 * estudiante ya lo tiene aprobado.
 *
 * No trae `statement`, ni el código inicial, ni los criterios: son campos grandes y esta vista
 * lista todos los ejercicios del curso a la vez. Los traerá la vista de resolución, que pide uno.
 */
export interface StudentExercise {
  /** Clave primaria del ejercicio. */
  id: number;

  /** Subtema al que pertenece. Es por lo que agrupa la lista. */
  lesson_id: number;

  /** Titulo que se muestra en la tarjeta. */
  name: string;

  /** Dificultad, para la etiqueta de color. */
  difficulty: ExerciseDifficulty;

  /** Posicion dentro del subtema. Decide cual se abre al completar el anterior. */
  order: number;
  /** Si existe al menos un intento aprobado suyo. Es la misma condición que usa la base. */
  passed: boolean;
}
