import { CriterionType } from '@domain/learning/models/exercise-criterion-model';
import { RawCriterion, toCriterion } from '@domain/learning/utils/criterion-parsing';

export { toCriterion };
export type { RawCriterion };

/**
 * Qué campos pide cada tipo de criterio.
 *
 * No hay dos tipos con la misma forma, así que esta tabla es la única fuente: de ella salen tanto
 * los controles que se construyen en el formulario como lo que se pinta en cada fila. Añadir un
 * tipo al catálogo es añadir una entrada aquí y un caso en `toCriterion`.
 */
export interface CriterionTypeMeta {
  /** El tipo de criterio que describe esta entrada. */
  type: CriterionType;

  /** Como se lee el tipo en el desplegable del formulario. */
  label: string;
  /** Ayuda corta bajo la fila, con un ejemplo de lo que se espera. */
  hint: string;

  /** Si el formulario debe mostrar el campo de selector. */
  selector: boolean;

  /** Si debe mostrar el campo de atributo. */
  attribute: boolean;

  /** Si debe mostrar el campo de propiedad CSS. */
  property: boolean;
  /**
   * `number` en `element_count` no es un detalle de presentación: `resultsFor` compara el valor
   * con `===` contra el conteo, y un «3» de un input de texto no casaría nunca con un 3.
   */
  value: 'none' | 'text' | 'number';
}

export const CRITERION_TYPES: CriterionTypeMeta[] = [
  {
    type: 'element_exists',
    label: 'Existe un elemento',
    hint: 'Comprueba que el selector encuentra al menos un elemento. Ej: #saludo',
    selector: true,
    attribute: false,
    property: false,
    value: 'none',
  },
  {
    type: 'element_count',
    label: 'Hay una cantidad exacta de elementos',
    hint: 'El selector debe encontrar exactamente esa cantidad. Ej: li, 3',
    selector: true,
    attribute: false,
    property: false,
    value: 'number',
  },
  {
    type: 'text_contains',
    label: 'El texto contiene',
    hint: 'Distingue mayúsculas, pero ignora saltos de línea y sangría del HTML.',
    selector: true,
    attribute: false,
    property: false,
    value: 'text',
  },
  {
    type: 'attribute_exists',
    label: 'Existe un atributo',
    hint: 'Un atributo presente pero vacío cuenta como existente. Ej: img, alt',
    selector: true,
    attribute: true,
    property: false,
    value: 'none',
  },
  {
    type: 'attribute_equals',
    label: 'Un atributo vale exactamente',
    hint: 'La comparación es exacta, incluidas mayúsculas. Ej: img, alt, Logo',
    selector: true,
    attribute: true,
    property: false,
    value: 'text',
  },
  {
    type: 'computed_style',
    label: 'Un estilo calculado vale',
    hint: 'Escribe el valor como lo devuelve el navegador: rgb(255, 0, 0), no red.',
    selector: true,
    attribute: false,
    property: true,
    value: 'text',
  },
  {
    type: 'console_contains',
    label: 'La consola imprime',
    hint: 'Busca el texto en cualquiera de las líneas impresas. Ej: 42',
    selector: false,
    attribute: false,
    property: false,
    value: 'text',
  },
];

export function metaFor(type: CriterionType): CriterionTypeMeta {
  return CRITERION_TYPES.find((meta) => meta.type === type) ?? CRITERION_TYPES[0];
}

/**
 * Lo que sale del formulario antes de recortarlo a la forma del criterio.
 *
 * Es el mismo tipo suelto que devuelve Gemini, asi que vive en el dominio: la vista de practica lo
 * necesita igual, y un feature de estudiante no puede importar de `features/teaching/`.
 */
export type CriterionFormValue = RawCriterion;

const quote = (text: unknown): string => `«${String(text ?? '')}»`;

/**
 * Descripción compuesta a partir de los campos.
 *
 * La descripción es obligatoria en todos los tipos y es lo que el estudiante lee como lista de
 * comprobación, pero escribir siete a mano cansa y acaban quedándose en blanco. Esta es un punto
 * de partida razonable; el formulario deja de rellenarla en cuanto el profesor escribe la
 * suya.
 */
export function suggestDescription(raw: CriterionFormValue): string {
  const selector = quote(raw.selector);

  switch (raw.type) {
    case 'element_exists':
      return `Existe un elemento ${selector}`;
    case 'element_count':
      return `Hay exactamente ${raw.value ?? 0} elementos ${selector}`;
    case 'text_contains':
      return `El texto de ${selector} contiene ${quote(raw.value)}`;
    case 'attribute_exists':
      return `${selector} tiene el atributo ${quote(raw.attribute)}`;
    case 'attribute_equals':
      return `El atributo ${quote(raw.attribute)} de ${selector} es ${quote(raw.value)}`;
    case 'computed_style':
      return `${selector} tiene ${quote(raw.property)} en ${quote(raw.value)}`;
    case 'console_contains':
      return `La consola imprime ${quote(raw.value)}`;
  }
}
