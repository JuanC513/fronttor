import { allSound, diagnoseCriteria } from './criteria-diagnosis';
import { CriterionResult } from './probe-model';

const result = (description: string, passed: boolean): CriterionResult => ({ description, passed });

describe('diagnoseCriteria', () => {
  it('da por bueno lo que la solución cumple y el inicial no', () => {
    const checks = diagnoseCriteria(
      [result('Existe el saludo', true)],
      [result('Existe el saludo', false)],
    );

    expect(checks).toEqual([
      { description: 'Existe el saludo', solution: true, starter: false, verdict: 'ok' },
    ]);
  });

  it('señala el criterio que ni la solución cumple', () => {
    const checks = diagnoseCriteria([result('Es roja', false)], [result('Es roja', false)]);
    expect(checks[0].verdict).toBe('fails_solution');
  });

  it('señala el criterio que el código inicial ya cumple', () => {
    // No evalúa nada: el estudiante lo aprueba sin escribir una línea.
    const checks = diagnoseCriteria([result('Hay un div', true)], [result('Hay un div', true)]);
    expect(checks[0].verdict).toBe('passes_starter');
  });

  it('cuando fallan las dos cosas, manda el fallo de la solución', () => {
    // El arreglo es el mismo, y decir las dos cosas a la vez despista más que ayuda.
    const checks = diagnoseCriteria([result('Raro', false)], [result('Raro', true)]);
    expect(checks[0].verdict).toBe('fails_solution');
  });

  it('trata como no cumplido lo que no tenga pareja en la otra ejecución', () => {
    const checks = diagnoseCriteria([result('Solo en una', true)], []);
    expect(checks[0]).toEqual({
      description: 'Solo en una',
      solution: true,
      starter: false,
      verdict: 'ok',
    });
  });
});

describe('allSound', () => {
  it('exige que todos estén bien planteados', () => {
    const buenos = diagnoseCriteria([result('a', true)], [result('a', false)]);
    const conUnoMalo = diagnoseCriteria(
      [result('a', true), result('b', false)],
      [result('a', false), result('b', false)],
    );

    expect(allSound(buenos)).toBeTrue();
    expect(allSound(conUnoMalo)).toBeFalse();
  });

  it('sin criterios no hay nada que dar por bueno', () => {
    expect(allSound([])).toBeFalse();
  });
});
