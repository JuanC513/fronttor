import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CriterionVerdict } from '@domain/code-runner/validation/criteria-diagnosis';
import { ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import { RawCriterion } from '@domain/learning/utils/criterion-parsing';

/** Lo que comparten las dos peticiones: de qué va el ejercicio y a qué nivel. */
interface PracticeRequestBase {
  /** Nombre del módulo, tal y como está en la base. */
  tema: string;
  /** Nombre del subtema. Es lo que fija de qué va el ejercicio. */
  subtema: string;
  /** Nivel que se le pide al modelo. El estudiante lo elige en el desplegable. */
  dificultad: ExerciseDifficulty;
  /** Lo que el estudiante escribió que quiere practicar. Opcional. */
  instruccion?: string;
  /** No entra en el prompt: es para que la interacción quede registrada con su subtema. */
  lessonId?: number;
}

/** Pide el ejercicio entero: título, enunciado, código inicial, solución y criterios. */
export interface GeneratePracticeRequest extends PracticeRequestBase {
  /** Discriminante: distingue esta peticion de la de reparacion. */
  modo: 'completo';
}

/**
 * Pide de nuevo solo los criterios, con el resultado de haberlos probado.
 *
 * El enunciado y los dos códigos viajan sin cambios: son el contexto contra el que hay que
 * reescribir los criterios, y lo que el modelo tiene prohibido tocar.
 */
export interface RepairPracticeRequest extends PracticeRequestBase {
  /** Discriminante: distingue esta peticion de la de generacion completa. */
  modo: 'criterios';

  /** Enunciado ya generado. Viaja como contexto y el modelo no debe tocarlo. */
  enunciado: string;

  /** Codigo de partida ya generado. Contexto, no se reescribe. */
  inicial: CodeRunnerState;

  /** Solucion ya generada. Es contra esto que los criterios deben aprobar. */
  solucion: CodeRunnerState;

  /** Cada criterio con lo que dio al probarlo. Es la evidencia de que hay que reescribirlos. */
  diagnostico: DiagnosedCriterion[];
}

/** Un criterio con lo que dio al ejecutarlo contra el código inicial y contra la solución. */
export interface DiagnosedCriterion {
  /** El criterio en su forma plana, tal y como lo devolvio el modelo. */
  criterio: RawCriterion;

  /** Que paso al correrlo: si aprobo donde debia y fallo donde debia. */
  veredicto: CriterionVerdict;
}

/**
 * Cualquiera de las dos peticiones a `generate-practice`.
 *
 * El servidor ramifica por `modo`: en `completo` arma el ejercicio entero y en `criterios` solo
 * reescribe la lista de comprobaciones.
 */
export type PracticeRequest = GeneratePracticeRequest | RepairPracticeRequest;

/**
 * El ejercicio tal y como lo devuelve el modelo.
 *
 * Los criterios llegan en su forma plana —todos los campos posibles, `value` siempre como cadena—
 * porque así los pide `CRITERIA_SCHEMA`. Recortarlos a su tipo real es cosa de quien llama, con
 * `toCriterion`, por el mismo camino que sigue un criterio escrito a mano por el profesor.
 */
export interface GeneratedPractice {
  /** Titulo corto para la cabecera del enunciado. */
  titulo: string;

  /** Enunciado en Markdown. */
  enunciado: string;

  /** Codigo con el que arranca el editor. */
  inicial: CodeRunnerState;

  /** Codigo que aprueba todos los criterios. */
  solucion: CodeRunnerState;

  /** Criterios en forma plana; quien llama los recorta con `toCriterion`. */
  criterios: RawCriterion[];
}

/** `resultado` es un `GeneratedPractice` en modo completo, y una lista plana en modo criterios. */
export interface GeneratePracticeResponse {
  /**
   * Va sin tipar a proposito: su forma depende del `modo` de la peticion, y quien llama ya sabe
   * cual pidio. Tiparlo como union obligaria a un estrechamiento que no aporta nada.
   */
  resultado?: unknown;
}
