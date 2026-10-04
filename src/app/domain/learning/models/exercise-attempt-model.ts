/** Resultado de un criterio concreto dentro de un intento. */
export interface CriterionResult {
  description: string;
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
  id: number;
  user_id: string;
  exercise_id: number;
  submitted_html: string;
  submitted_css: string;
  submitted_js: string;
  passed: boolean;
  results: CriterionResult[];
  /** Retroalimentacion de la IA sobre este intento. */
  feedback: string | null;
  created_at: string;
}
