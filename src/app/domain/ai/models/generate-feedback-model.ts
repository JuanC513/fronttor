/** Un criterio tal y como viaja al modelo: qué pedía y si el envío lo cumplió. */
export interface FeedbackCriterion {
  description: string;
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
  criterio?: number;
  pista: string;
}

/** Espejo del cuerpo que espera la Edge Function `generate-feedback`. */
export interface GenerateFeedbackRequest {
  enunciado: string;
  html?: string;
  css?: string;
  js?: string;
  criterios: FeedbackCriterion[];
  /** Si el envío no llegó a responder. Cambia lo que el modelo puede decir. */
  agotoTiempo?: boolean;
  /** No entran en el prompt: son para que la función deje la interacción registrada. */
  exerciseId?: number;
  lessonId?: number;
}

export interface GenerateFeedbackResponse {
  feedback: FeedbackHint;
}
