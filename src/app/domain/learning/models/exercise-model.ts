import { ExerciseCriterion } from './exercise-criterion-model';

/** Espejo del check de la columna `difficulty` */
export type ExerciseDifficulty = 'facil' | 'media' | 'dificil';

/**
 * Como se lee cada dificultad en pantalla.
 *
 * Vive junto al tipo y no en cada vista porque llego a estar copiada en cuatro archivos: la lista
 * del estudiante, la de un ejercicio suelto, el panel del profesor y el formulario. Cuatro sitios
 * donde cambiar una tilde.
 */
export const DIFFICULTY_LABEL: Record<ExerciseDifficulty, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
};

/** Espejo del check de la columna `source` */
export type ExerciseSource = 'manual' | 'ia';

export interface Exercise {
  id: number;
  lesson_id: number;
  name: string;
  // Markdown; se renderiza con MarkdownRenderer
  statement: string;
  difficulty: ExerciseDifficulty;
  starter_html: string;
  starter_css: string;
  starter_js: string;
  // Codigo que SI cumple los criterios. Sirve para comprobar que estan bien escritos: un
  // computed_style con el valor mal normalizado solo se delata al correrlo contra algo que
  // deberia aprobarlo.
  solution_html: string;
  solution_css: string;
  solution_js: string;
  // Un ejercicio sin criterios nunca se aprueba
  criteria: ExerciseCriterion[];
  source: ExerciseSource;
  // Nace en borrador; solo los publicados cuentan para completar el subtema
  is_published: boolean;
  order: number;
  created_at: string;
}

/**
 * Campos editables de un ejercicio.
 *
 * Se pasan como objeto y no como argumentos sueltos: las RPC de insercion y actualizacion tienen
 * trece y catorce parametros, y una llamada con esa cantidad de valores posicionales es ilegible y
 * facil de descuadrar sin que el compilador lo note, porque casi todos son cadenas.
 */
export interface ExerciseInput {
  lesson_id: number;
  name: string;
  statement: string;
  difficulty: ExerciseDifficulty;
  starter_html: string;
  starter_css: string;
  starter_js: string;
  solution_html: string;
  solution_css: string;
  solution_js: string;
  criteria: ExerciseCriterion[];
  source: ExerciseSource;
  is_published: boolean;
}
