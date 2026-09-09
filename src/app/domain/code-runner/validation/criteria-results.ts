import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { CriterionResult, ProbeValue } from './probe-model';

/**
 * Compara lo que el documento respondio con lo que cada criterio esperaba.
 *
 * Es el corazon del motor y es una funcion pura: no toca el DOM ni el iframe, asi que se puede
 * comprobar entera con datos de mesa.
 *
 * Criterios de comparacion, todos deliberados:
 *
 * - **Distingue entre no encontrado y vacio.** Un `attribute_equals` contra la cadena vacia no
 *   puede aprobar un elemento que no existe.
 * - **`text_contains` colapsa los espacios** antes de comparar, porque el `textContent` arrastra
 *   los saltos de linea y la sangria del HTML. La comparacion si distingue mayusculas: la
 *   descripcion del criterio le dice al estudiante el texto exacto que se espera.
 * - **`computed_style` compara literalmente** contra `getComputedStyle`, que devuelve valores ya
 *   normalizados por el navegador (`rgb(255, 0, 0)`, no `red`). Es el error mas comun al escribir
 *   criterios y es justo lo que la solucion de referencia sirve para descubrir.
 */
export function resultsFor(
  criteria: ExerciseCriterion[],
  values: ProbeValue[],
  logs: string[],
): CriterionResult[] {
  const byId = new Map(values.map((value) => [value.id, value]));

  return criteria.map((criterion, id) => ({
    description: criterion.description,
    passed: evaluate(criterion, byId.get(id), logs),
  }));
}

/**
 * Si el intento aprueba el ejercicio completo.
 *
 * Un ejercicio sin criterios **nunca** se aprueba, aunque `every` sobre una lista vacia sea cierto.
 * La alternativa seria que un ejercicio a medio escribir se diera por resuelto con solo abrirlo, y
 * ademas contaria para completar el subtema.
 */
export function hasPassed(criteria: ExerciseCriterion[], results: CriterionResult[]): boolean {
  return criteria.length > 0 && results.every((result) => result.passed);
}

function evaluate(
  criterion: ExerciseCriterion,
  probe: ProbeValue | undefined,
  logs: string[],
): boolean {
  if (criterion.type === 'console_contains') {
    return logs.some((log) => log.includes(criterion.value));
  }

  // Sin respuesta no se puede afirmar nada, y ante la duda el criterio no se da por cumplido.
  if (!probe) return false;

  switch (criterion.type) {
    case 'element_exists':
      return typeof probe.value === 'number' && probe.value > 0;

    case 'element_count':
      return probe.value === criterion.value;

    case 'text_contains':
      return probe.found && collapse(String(probe.value ?? '')).includes(collapse(criterion.value));

    case 'attribute_exists':
      // Un atributo presente pero vacio (`alt=""`) existe: es HTML valido y deliberado.
      return probe.found && probe.value !== null;

    case 'attribute_equals':
    case 'computed_style':
      return probe.found && probe.value === criterion.value;
  }
}

/** Reduce cualquier racha de espacios, tabulaciones y saltos de linea a un solo espacio. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
