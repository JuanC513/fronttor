import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';

/** Las cuatro piezas de un ejercicio, una por pestaña del formulario. */
export type ExercisePart = 'statement' | 'starter' | 'solution' | 'criteria';

export interface ExerciseCode {
  html: string;
  css: string;
  js: string;
}

/** Espejo de `ExercisePromptInput` en la Edge Function `generate-exercise`. */
export interface GenerateExerciseRequest {
  parte: ExercisePart;
  tema: string;
  subtema: string;
  nombre: string;
  dificultad: string;
  /**
   * Estado actual completo del ejercicio, incluida la parte que se va a generar.
   *
   * Viaja entero en todas las llamadas: es lo que permite que los criterios se deriven del código
   * ya escrito, y que pedir un ajuste sobre un enunciado existente lo retoque en vez de tirarlo.
   */
  enunciado?: string;
  inicial?: ExerciseCode;
  solucion?: ExerciseCode;
  criterios?: ExerciseCriterion[];
  instruccion?: string;
}

/**
 * El enunciado viene como markdown en `enunciado`; el resto de partes, ya analizado, en
 * `resultado`: un `ExerciseCode` para los códigos y una lista plana de criterios para los
 * criterios, que el formulario recorta con `toCriterion`.
 */
export interface GenerateExerciseResponse {
  enunciado?: string;
  resultado?: unknown;
}
