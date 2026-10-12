/** Resultado de un criterio concreto dentro de un intento. */
export interface CriterionResult {
  /** El texto del criterio, copiado al guardar el intento. */
  description: string;

  /** Si el envio cumplio ese criterio. */
  passed: boolean;
}

/**
 * Un envio del estudiante. Se guardan todos los intentos, no solo el ultimo:
 * es lo que alimenta la dificultad adaptativa
 *
 * Ojo con `passed`: hoy lo calcula el cliente, y el canal `postMessage` del
 * iframe no verifica el emisor, asi que un estudiante podria falsificarlo. Es
 * una limitacion conocida y documentada del alcance educativo del sistema.
 */
export interface ExerciseAttempt {
  /** Clave primaria en `public.exercise_attempts`. */
  id: number;

  /** Quien envio. Borrar la cuenta arrastra sus intentos en cascada. */
  user_id: string;

  /** Ejercicio al que responde. Borrar el ejercicio tambien los arrastra. */
  exercise_id: number;

  /** HTML tal y como lo envio el estudiante. */
  submitted_html: string;

  /** CSS tal y como lo envio el estudiante. */
  submitted_css: string;

  /** JavaScript tal y como lo envio el estudiante. */
  submitted_js: string;

  /** Si el intento aprobo. Ver la advertencia de arriba sobre quien lo calcula. */
  passed: boolean;

  /**
   * Resultado criterio a criterio.
   *
   * Su longitud importa: `get_student_context` descarta los intentos cuyo numero de resultados no
   * cuadra con los criterios vigentes, que es por lo que editar `criteria` invalida el historial.
   */
  results: CriterionResult[];
  /** Retroalimentacion de la IA sobre este intento. */
  feedback: string | null;

  /** Momento del envio, en ISO 8601. Es lo que ordena el historial. */
  created_at: string;
}
