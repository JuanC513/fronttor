/**
 * Criterios declarativos con los que se valida un ejercicio.
 *
 * Es una union discriminada por `type` y no una interfaz con todo opcional: el
 * motor de validacion hace `switch (criterion.type)`, y con `strict` activado la
 * union le da exhaustividad en tiempo de compilacion. Si manana se agrega un
 * tipo al catalogo, el compilador senala donde falta manejarlo.
 *
 * El catalogo es cerrado a proposito. No incluye nada tipo `function_exists`
 * porque `preview-panel.ts` ejecuta el JS del estudiante con `new Function`, asi
 * que sus declaraciones quedan en scope de funcion y nunca llegan a `window`.
 * Los ejercicios de JavaScript se validan con `console_contains` y con
 * aserciones sobre el DOM que ese codigo haya modificado.
 */

interface BaseCriterion {
  /**
   * Lo que ve el estudiante en la lista de comprobacion. Obligatorio en todos
   * los tipos: es donde esta el valor pedagogico frente a un si/no
   */
  description: string;
}

/** Aprueba si el selector encuentra al menos un elemento. */
export interface ElementExistsCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'element_exists';

  /** Selector CSS que se busca en el DOM renderizado. */
  selector: string;
}

/** Aprueba si el selector encuentra exactamente `value` elementos. */
export interface ElementCountCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'element_count';

  /** Selector CSS cuyos resultados se cuentan. */
  selector: string;

  /** Cantidad exacta esperada. No es un minimo. */
  value: number;
}

/** Aprueba si el texto del elemento contiene `value`. */
export interface TextContainsCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'text_contains';

  /** Selector CSS del elemento cuyo texto se inspecciona. */
  selector: string;

  /** Fragmento que debe aparecer dentro del texto. */
  value: string;
}

/** Aprueba si el elemento declara el atributo, sea cual sea su valor. */
export interface AttributeExistsCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'attribute_exists';

  /** Selector CSS del elemento que debe llevar el atributo. */
  selector: string;

  /** Nombre del atributo, sin corchetes. */
  attribute: string;
}

/** Aprueba si el atributo existe y ademas vale exactamente `value`. */
export interface AttributeEqualsCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'attribute_equals';

  /** Selector CSS del elemento. */
  selector: string;

  /** Nombre del atributo a comparar. */
  attribute: string;

  /** Valor exacto que debe tener el atributo. */
  value: string;
}

/** Aprueba si la propiedad calculada del elemento coincide con `value`. */
export interface ComputedStyleCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'computed_style';

  /** Selector CSS del elemento cuyo estilo se mide. */
  selector: string;

  /** Propiedad CSS, en su forma con guiones (`background-color`). */
  property: string;

  /**
   * Se compara contra `getComputedStyle`, asi que debe escribirse como lo
   * normaliza el navegador (`rgb(255, 0, 0)`, no `red`).
   */
  value: string;
}

/**
 * Aprueba si alguna salida de `console.log` contiene `value`.
 *
 * No lleva `selector`: es el unico criterio que no mira el DOM. Es la via para validar ejercicios
 * de JavaScript puro, por lo que explica la nota de arriba sobre `new Function`.
 */
export interface ConsoleContainsCriterion extends BaseCriterion {
  /** Discriminante de la union. */
  type: 'console_contains';

  /** Fragmento que debe aparecer en alguna linea de la consola. */
  value: string;
}

/**
 * Cualquiera de los criterios del catalogo.
 *
 * Es el tipo que viaja en `Exercise.criteria` y el que recorre el motor de validacion.
 */
export type ExerciseCriterion =
  | ElementExistsCriterion
  | ElementCountCriterion
  | TextContainsCriterion
  | AttributeExistsCriterion
  | AttributeEqualsCriterion
  | ComputedStyleCriterion
  | ConsoleContainsCriterion;

/**
 * Los discriminantes del catalogo, derivados de la union.
 *
 * Se extrae con `ExerciseCriterion['type']` en vez de repetir la lista a mano para que anadir un
 * criterio nuevo no exija acordarse de actualizar tambien este tipo.
 */
export type CriterionType = ExerciseCriterion['type'];
