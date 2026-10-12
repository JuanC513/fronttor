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

/** Un ejercicio completo, con su solucion de referencia. */
export interface Exercise {
  /** Clave primaria en `public.exercises`. */
  id: number;

  /** Subtema al que pertenece. Borrar la leccion arrastra el ejercicio en cascada. */
  lesson_id: number;

  /** Titulo que ve el estudiante en la lista y en la cabecera del enunciado. */
  name: string;

  /** Enunciado en Markdown; se renderiza con `MarkdownRenderer`. */
  statement: string;

  /** Etiqueta de dificultad. Se muestra con `DIFFICULTY_LABEL`, no en crudo. */
  difficulty: ExerciseDifficulty;

  /** HTML con el que arranca el editor del estudiante. */
  starter_html: string;

  /** CSS con el que arranca el editor del estudiante. */
  starter_css: string;

  /** JavaScript con el que arranca el editor del estudiante. */
  starter_js: string;

  /**
   * HTML que SI cumple los criterios.
   *
   * Las tres columnas de solucion sirven para comprobar que los criterios estan bien escritos: un
   * `computed_style` con el valor mal normalizado solo se delata al correrlo contra algo que
   * deberia aprobarlo.
   */
  solution_html: string;

  /** CSS de la solucion de referencia. Ver {@link Exercise.solution_html}. */
  solution_css: string;

  /** JavaScript de la solucion de referencia. Ver {@link Exercise.solution_html}. */
  solution_js: string;

  /** Comprobaciones que decide si el envio aprueba. Un ejercicio sin criterios no se aprueba nunca. */
  criteria: ExerciseCriterion[];

  /** Si lo escribio un profesor a mano o lo genero el modelo. */
  source: ExerciseSource;

  /** Nace en borrador; solo los publicados cuentan para completar el subtema. */
  is_published: boolean;

  /** Posicion dentro del subtema. Los ejercicios se abren en este orden. */
  order: number;

  /** Marca de creacion que pone la base, en ISO 8601. */
  created_at: string;
}

/**
 * Un ejercicio sin la solucion de referencia.
 *
 * Es lo que la API entrega a cualquier usuario con sesion: desde
 * 20260926120000_hide_exercise_solution.sql, `authenticated` no tiene SELECT sobre las tres
 * columnas de solucion, y el unico camino hacia ellas es la RPC `get_exercise_for_edit`.
 *
 * Existe para que el tipo no mienta. Las lecturas del panel del profesor devuelven esto; solo
 * `ExerciseService.getById`, que pasa por la RPC, devuelve un `Exercise` entero.
 */
export type ExerciseWithoutSolution = Omit<
  Exercise,
  'solution_html' | 'solution_css' | 'solution_js'
>;

/**
 * Campos editables de un ejercicio.
 *
 * Se pasan como objeto y no como argumentos sueltos: las RPC de insercion y actualizacion tienen
 * trece y catorce parametros, y una llamada con esa cantidad de valores posicionales es ilegible y
 * facil de descuadrar sin que el compilador lo note, porque casi todos son cadenas.
 */
export interface ExerciseInput {
  /** Subtema al que se asigna. */
  lesson_id: number;

  /** Titulo del ejercicio. */
  name: string;

  /** Enunciado en Markdown. */
  statement: string;

  /** Dificultad declarada por quien lo crea. */
  difficulty: ExerciseDifficulty;

  /** HTML de partida para el estudiante. */
  starter_html: string;

  /** CSS de partida para el estudiante. */
  starter_css: string;

  /** JavaScript de partida para el estudiante. */
  starter_js: string;

  /** HTML de la solucion de referencia. */
  solution_html: string;

  /** CSS de la solucion de referencia. */
  solution_css: string;

  /** JavaScript de la solucion de referencia. */
  solution_js: string;

  /**
   * Criterios con los que se evalua.
   *
   * Cambiarlos invalida los intentos anteriores para `fallosPorTipo`: `get_student_context`
   * descarta los intentos cuyo numero de resultados no cuadra con los criterios vigentes.
   */
  criteria: ExerciseCriterion[];

  /** Origen del ejercicio, manual o generado. */
  source: ExerciseSource;

  /** Si se guarda publicado o como borrador. */
  is_published: boolean;
}
