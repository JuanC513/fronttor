import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';

/** Las cuatro piezas de un ejercicio, una por pestaña del formulario. */
export type ExercisePart = 'statement' | 'starter' | 'solution' | 'criteria';

/** Las tres pestañas de código de un ejercicio, agrupadas. */
export interface ExerciseCode {
  /** Contenido de la pestaña HTML. */
  html: string;

  /** Contenido de la pestaña CSS. */
  css: string;

  /** Contenido de la pestaña JS. */
  js: string;
}

/** Espejo de `ExercisePromptInput` en la Edge Function `generate-exercise`. */
export interface GenerateExerciseRequest {
  /** Cuál de las cuatro piezas se pide. Decide qué prompt arma el servidor. */
  parte: ExercisePart;

  /** Nombre del módulo, para situar al modelo. */
  tema: string;

  /** Nombre del subtema. Acota de qué va el ejercicio. */
  subtema: string;

  /** Título que el profesor ya escribió en el formulario. */
  nombre: string;

  /** Dificultad declarada. Llega como cadena porque el formulario aún no la ha validado. */
  dificultad: string;
  /**
   * Estado actual completo del ejercicio, incluida la parte que se va a generar.
   *
   * Viaja entero en todas las llamadas: es lo que permite que los criterios se deriven del código
   * ya escrito, y que pedir un ajuste sobre un enunciado existente lo retoque en vez de tirarlo.
   */
  enunciado?: string;

  /** Código de partida actual. Ver la nota de {@link GenerateExerciseRequest.enunciado}. */
  inicial?: ExerciseCode;

  /** Solución actual. Es de donde se derivan los criterios cuando se piden. */
  solucion?: ExerciseCode;

  /** Criterios actuales, ya en su forma tipada. */
  criterios?: ExerciseCriterion[];

  /** Lo que el profesor pide en palabras, si escribió algo. Opcional. */
  instruccion?: string;
  /** No entra en el prompt: es para que la interacción quede registrada con su subtema. */
  lessonId?: number;
  /** Tampoco entra en el prompt. Solo lo hay al ajustar un ejercicio ya guardado. */
  exerciseId?: number;
}

/**
 * El enunciado viene como markdown en `enunciado`; el resto de partes, ya analizado, en
 * `resultado`: un `ExerciseCode` para los códigos y una lista plana de criterios para los
 * criterios, que el formulario recorta con `toCriterion`.
 */
export interface GenerateExerciseResponse {
  /** Solo viene al pedir la parte `statement`. Markdown sin analizar. */
  enunciado?: string;

  /**
   * Las otras tres partes. Sin tipar porque su forma depende de `parte`: `ExerciseCode` para los
   * códigos y una lista plana de criterios para los criterios.
   */
  resultado?: unknown;
}
