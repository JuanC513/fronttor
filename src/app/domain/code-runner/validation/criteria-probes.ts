import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { Probe } from './probe-model';

/**
 * Traduce los criterios de un ejercicio a las preguntas que hay que hacerle al documento.
 *
 * El `id` de cada sonda es el indice de su criterio, que es lo que despues permite emparejar
 * respuestas con criterios sin llevar ninguna correspondencia aparte.
 *
 * `console_contains` no genera sonda: su respuesta no esta en el DOM sino en los logs, que el
 * script del iframe devuelve siempre.
 *
 * No se eliminan sondas repetidas a proposito. Dos criterios sobre el mismo selector generan dos
 * preguntas identicas, y responderlas dos veces cuesta menos que llevar la contabilidad de cual
 * respuesta reutiliza cual.
 */
export function probesFor(criteria: ExerciseCriterion[]): Probe[] {
  const probes: Probe[] = [];

  criteria.forEach((criterion, id) => {
    switch (criterion.type) {
      case 'element_exists':
      case 'element_count':
        probes.push({ id, kind: 'count', selector: criterion.selector });
        break;

      case 'text_contains':
        probes.push({ id, kind: 'text', selector: criterion.selector });
        break;

      case 'attribute_exists':
      case 'attribute_equals':
        probes.push({
          id,
          kind: 'attribute',
          selector: criterion.selector,
          attribute: criterion.attribute,
        });
        break;

      case 'computed_style':
        probes.push({
          id,
          kind: 'style',
          selector: criterion.selector,
          property: criterion.property,
        });
        break;

      case 'console_contains':
        // Se resuelve con los logs, no con el documento.
        break;
    }
  });

  return probes;
}
