import { CriterionResult } from './probe-model';

/**
 * Lectura cruzada de las dos ejecuciones que hace el profesor al comprobar un ejercicio.
 *
 * Correrlo contra la solución detecta el criterio mal escrito. Pero hay un segundo error igual de
 * silencioso: **un criterio que el código inicial ya cumple**. Ese ejercicio pide algo que el
 * estudiante recibe hecho, se aprueba sin escribir una línea, y el subtema se completa solo.
 *
 * Las dos ejecuciones cuestan lo mismo que una y juntas dan el diagnóstico completo.
 */
export type CriterionVerdict = 'ok' | 'fails_solution' | 'passes_starter';

/** Un criterio probado contra las dos ejecuciones, con su veredicto. */
export interface CriterionCheck {
  /** El texto del criterio que se diagnostica. */
  description: string;
  /** Si se cumple con la solución de referencia. */
  solution: boolean;
  /** Si se cumple ya con el código inicial. */
  starter: boolean;

  /**
   * Las dos comprobaciones anteriores, resumidas.
   *
   * Un criterio sano aprueba con la solución y falla con el inicial. Si aprueba con los dos no
   * mide nada, y si falla con los dos está mal escrito.
   */
  verdict: CriterionVerdict;
}

export function diagnoseCriteria(
  solution: CriterionResult[],
  starter: CriterionResult[],
): CriterionCheck[] {
  return solution.map((result, index) => {
    const passesStarter = starter[index]?.passed ?? false;

    return {
      description: result.description,
      solution: result.passed,
      starter: passesStarter,
      verdict: verdictFor(result.passed, passesStarter),
    };
  });
}

/** Si todos los criterios están bien planteados. Sin criterios no hay nada que dar por bueno. */
export function allSound(checks: CriterionCheck[]): boolean {
  return checks.length > 0 && checks.every((check) => check.verdict === 'ok');
}

/**
 * Que falle con la solución manda sobre lo demás: si ni el código que debería aprobarlo lo cumple,
 * saber además que el inicial tampoco no añade nada, y el arreglo es el mismo.
 */
function verdictFor(passesSolution: boolean, passesStarter: boolean): CriterionVerdict {
  if (!passesSolution) return 'fails_solution';
  if (passesStarter) return 'passes_starter';
  return 'ok';
}

export const VERDICT_MESSAGE: Record<CriterionVerdict, string> = {
  ok: 'Correcto: pide algo que la solución cumple.',
  fails_solution: 'Ni tu propia solución lo cumple. Revisa cómo está escrito.',
  passes_starter: 'El código inicial ya lo cumple, así que no está pidiendo nada.',
};
