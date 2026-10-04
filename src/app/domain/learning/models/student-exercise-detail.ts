import { ExerciseCriterion } from './exercise-criterion-model';
import { ExerciseDifficulty } from './exercise-model';

/**
 * Un ejercicio publicado con todo lo que hace falta para resolverlo.
 *
 * Es la contrapartida de {@link StudentExercise}, que solo trae lo que la lista necesita. Aquí sí
 * viajan el enunciado, el código inicial y los criterios, porque se pide de uno en uno.
 *
 * **Lo que deliberadamente NO tiene es `solution_html`, `solution_css` ni `solution_js`.** Son las
 * columnas donde vive la respuesta, y la consulta que llena este modelo no las pide justo por eso
 * (ver `ExerciseService.getForStudent`).
 *
 * Los criterios, en cambio, sí se entregan: son la especificación de lo que hay que lograr, no la
 * forma de lograrlo, y el estudiante necesita verlos para saber qué se le pide.
 */
export interface StudentExerciseDetail {
  id: number;
  lesson_id: number;
  name: string;
  /** Markdown; se renderiza con `MarkdownRenderer`. */
  statement: string;
  difficulty: ExerciseDifficulty;
  starter_html: string;
  starter_css: string;
  starter_js: string;
  criteria: ExerciseCriterion[];
  /**
   * Si ya tiene al menos un intento aprobado. Misma condición que usa la base para completar un
   * subtema, y la que hace que volver a abrir un ejercicio resuelto lo diga desde el principio.
   */
  passed: boolean;
}
