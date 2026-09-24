import { CriterionType, ExerciseCriterion } from '../models/exercise-criterion-model';

/**
 * Un criterio en su forma suelta, antes de recortarlo al tipo que le corresponde.
 *
 * Es la forma en la que un criterio llega de los dos sitios que lo producen, y por eso vive en el
 * dominio y no junto a un formulario:
 *
 * - del formulario del profesor, donde todos los controles existen aunque el tipo elegido no los
 *   use, así que sobran campos;
 * - de Gemini, cuyo `responseSchema` es plano por la misma razón —`CRITERIA_SCHEMA` pide todos los
 *   campos posibles como opcionales y `value` siempre como cadena, porque las uniones por `anyOf`
 *   no son fiables y `value` es número en `element_count` y cadena en el resto—.
 */
export interface RawCriterion {
  type: CriterionType;
  description?: string | null;
  selector?: string | null;
  attribute?: string | null;
  property?: string | null;
  value?: string | number | null;
}

/**
 * Recorta el criterio suelto a la forma exacta de su tipo.
 *
 * Es la frontera con lo que se guarda y con lo que se ejecuta. Sin este recorte, un `attribute` que
 * quedara de haber cambiado el tipo viajaría hasta el JSON de `criteria` y se quedaría ahí para
 * siempre; y el `value` que Gemini devuelve siempre como cadena nunca casaría con el conteo de
 * `element_count`, que `resultsFor` compara con `===`.
 */
export function toCriterion(raw: RawCriterion): ExerciseCriterion {
  const description = (raw.description ?? '').trim();
  const selector = (raw.selector ?? '').trim();
  const attribute = (raw.attribute ?? '').trim();
  const property = (raw.property ?? '').trim();

  switch (raw.type) {
    case 'element_exists':
      return { type: 'element_exists', description, selector };
    case 'element_count':
      return { type: 'element_count', description, selector, value: Number(raw.value ?? 0) };
    case 'text_contains':
      return { type: 'text_contains', description, selector, value: String(raw.value ?? '') };
    case 'attribute_exists':
      return { type: 'attribute_exists', description, selector, attribute };
    case 'attribute_equals':
      return {
        type: 'attribute_equals',
        description,
        selector,
        attribute,
        value: String(raw.value ?? ''),
      };
    case 'computed_style':
      return {
        type: 'computed_style',
        description,
        selector,
        property,
        value: String(raw.value ?? ''),
      };
    case 'console_contains':
      return { type: 'console_contains', description, value: String(raw.value ?? '') };
  }
}
