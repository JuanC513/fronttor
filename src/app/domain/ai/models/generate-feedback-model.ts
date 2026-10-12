/** Un criterio tal y como viaja al modelo: qué pedía y si el envío lo cumplió. */
export interface FeedbackCriterion {
  /** El texto del criterio, el mismo que ve el estudiante en «Qué se comprueba». */
  description: string;

  /** Si el envío lo cumplió. Es lo que decide sobre qué puede dar pista el modelo. */
  passed: boolean;
}

/**
 * Lo que el modelo devuelve: una pista, y opcionalmente a qué criterio se refiere.
 *
 * `criterio` es el número del criterio dentro de la lista enviada, **empezando en 1**, porque es
 * así como se le presentan en el prompt. Llega sin validar: que exista y que apunte a un criterio
 * realmente fallido lo comprueba `resolveHintFocus`.
 *
 * Es opcional a propósito. Cuando el código del estudiante agota el tiempo no se comprueba ningún
 * criterio, así que no hay ninguno que señalar y solo queda la pista.
 */
export interface FeedbackHint {
  /** Número del criterio señalado dentro de la lista enviada, empezando en 1. Llega sin validar. */
  criterio?: number;

  /** La pista en sí. Orienta sin dar la solución. */
  pista: string;
}

/** Espejo del cuerpo que espera la Edge Function `generate-feedback`. */
export interface GenerateFeedbackRequest {
  /** Enunciado del ejercicio, para que la pista hable de lo que se pedía. */
  enunciado: string;

  /** HTML que envió el estudiante. Contenido no confiable. */
  html?: string;

  /** CSS que envió el estudiante. Contenido no confiable. */
  css?: string;

  /** JavaScript que envió el estudiante. Contenido no confiable. */
  js?: string;

  /** Los criterios con su resultado. El modelo solo puede dar pista sobre los fallados. */
  criterios: FeedbackCriterion[];
  /** Si el envío no llegó a responder. Cambia lo que el modelo puede decir. */
  agotoTiempo?: boolean;
  /** No entran en el prompt: son para que la función deje la interacción registrada. */
  exerciseId?: number;

  /** Subtema del ejercicio. Tampoco entra en el prompt. */
  lessonId?: number;
}

/** Lo que devuelve `generate-feedback`. */
export interface GenerateFeedbackResponse {
  /** La pista y, si la hay, el criterio al que apunta. */
  feedback: FeedbackHint;
}
