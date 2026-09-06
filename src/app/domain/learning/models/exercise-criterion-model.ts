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

export interface ElementExistsCriterion extends BaseCriterion {
  type: 'element_exists';
  selector: string;
}

export interface ElementCountCriterion extends BaseCriterion {
  type: 'element_count';
  selector: string;
  value: number;
}

export interface TextContainsCriterion extends BaseCriterion {
  type: 'text_contains';
  selector: string;
  value: string;
}

export interface AttributeExistsCriterion extends BaseCriterion {
  type: 'attribute_exists';
  selector: string;
  attribute: string;
}

export interface AttributeEqualsCriterion extends BaseCriterion {
  type: 'attribute_equals';
  selector: string;
  attribute: string;
  value: string;
}

export interface ComputedStyleCriterion extends BaseCriterion {
  type: 'computed_style';
  selector: string;
  property: string;
  /**
   * Se compara contra `getComputedStyle`, asi que debe escribirse como lo
   * normaliza el navegador (`rgb(255, 0, 0)`, no `red`).
   */
  value: string;
}

export interface ConsoleContainsCriterion extends BaseCriterion {
  type: 'console_contains';
  value: string;
}

export type ExerciseCriterion =
  | ElementExistsCriterion
  | ElementCountCriterion
  | TextContainsCriterion
  | AttributeExistsCriterion
  | AttributeEqualsCriterion
  | ComputedStyleCriterion
  | ConsoleContainsCriterion;

export type CriterionType = ExerciseCriterion['type'];
