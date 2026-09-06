import { ExerciseCriterion } from './exercise-criterion-model';

/** Espejo del check de la columna `difficulty` */
export type ExerciseDifficulty = 'facil' | 'media' | 'dificil';

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
  // Un ejercicio sin criterios nunca se aprueba
  criteria: ExerciseCriterion[];
  source: ExerciseSource;
  // Nace en borrador; solo los publicados cuentan para completar el subtema
  is_published: boolean;
  order: number;
  created_at: string;
}
