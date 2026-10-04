import { FeedbackCriterion, FeedbackHint } from '../models/generate-feedback-model';

/**
 * A qué criterio apunta una pista, si es que apunta a alguno válido.
 *
 * Devuelve el índice **base 0** dentro de la lista de criterios, o `null` si la pista no señala
 * ninguno que merezca resaltarse.
 *
 * ## Por qué esto no es una conversión de número, sino una validación
 *
 * El `criterio` lo elige un modelo generativo, y lo único que garantiza el `responseSchema` es que
 * sea un entero si viene. Nada impide que sea 9 sobre una lista de 5, ni que señale un criterio que
 * el estudiante ya cumple. Las dos cosas se han de descartar, y por motivos distintos:
 *
 * - **Fuera de rango** resaltaría un criterio inexistente, o ninguno, según cómo lo pinte la vista.
 * - **Un criterio que sí pasó** es peor, porque es plausible: el estudiante leería una pista sobre
 *   algo que ya tiene bien y se pondría a "arreglarlo".
 *
 * En los dos casos la pista se conserva —suele seguir siendo útil— y lo que se descarta es el
 * resaltado. Una pista buena señalando el sitio equivocado hace más daño que una pista sola.
 *
 * El modelo cuenta desde 1 porque así se le numeran los criterios en el prompt; aquí se traduce a
 * índice de arreglo una sola vez, en el único sitio que conoce esa diferencia.
 */
export function resolveHintFocus(
  hint: Pick<FeedbackHint, 'criterio'> | null,
  criterios: FeedbackCriterion[],
): number | null {
  const position = hint?.criterio;

  if (typeof position !== 'number' || !Number.isInteger(position)) return null;

  const index = position - 1;
  const criterion = criterios[index];

  if (!criterion || criterion.passed) return null;

  return index;
}
