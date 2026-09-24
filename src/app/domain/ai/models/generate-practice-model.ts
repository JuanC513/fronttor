import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CriterionVerdict } from '@domain/code-runner/validation/criteria-diagnosis';
import { ExerciseDifficulty } from '@domain/learning/models/exercise-model';
import { RawCriterion } from '@domain/learning/utils/criterion-parsing';

interface PracticeRequestBase {
  /** Nombre del módulo, tal y como está en la base. */
  tema: string;
  /** Nombre del subtema. Es lo que fija de qué va el ejercicio. */
  subtema: string;
  dificultad: ExerciseDifficulty;
  /** Lo que el estudiante escribió que quiere practicar. Opcional. */
  instruccion?: string;
}

/** Pide el ejercicio entero: título, enunciado, código inicial, solución y criterios. */
export interface GeneratePracticeRequest extends PracticeRequestBase {
  modo: 'completo';
}

/**
 * Pide de nuevo solo los criterios, con el resultado de haberlos probado.
 *
 * El enunciado y los dos códigos viajan sin cambios: son el contexto contra el que hay que
 * reescribir los criterios, y lo que el modelo tiene prohibido tocar.
 */
export interface RepairPracticeRequest extends PracticeRequestBase {
  modo: 'criterios';
  enunciado: string;
  inicial: CodeRunnerState;
  solucion: CodeRunnerState;
  diagnostico: DiagnosedCriterion[];
}

/** Un criterio con lo que dio al ejecutarlo contra el código inicial y contra la solución. */
export interface DiagnosedCriterion {
  criterio: RawCriterion;
  veredicto: CriterionVerdict;
}

export type PracticeRequest = GeneratePracticeRequest | RepairPracticeRequest;

/**
 * El ejercicio tal y como lo devuelve el modelo.
 *
 * Los criterios llegan en su forma plana —todos los campos posibles, `value` siempre como cadena—
 * porque así los pide `CRITERIA_SCHEMA`. Recortarlos a su tipo real es cosa de quien llama, con
 * `toCriterion`, por el mismo camino que sigue un criterio escrito a mano por el profesor.
 */
export interface GeneratedPractice {
  titulo: string;
  enunciado: string;
  inicial: CodeRunnerState;
  solucion: CodeRunnerState;
  criterios: RawCriterion[];
}

/** `resultado` es un `GeneratedPractice` en modo completo, y una lista plana en modo criterios. */
export interface GeneratePracticeResponse {
  resultado?: unknown;
}
