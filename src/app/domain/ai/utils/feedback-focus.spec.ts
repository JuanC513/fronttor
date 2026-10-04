import { FeedbackCriterion } from '../models/generate-feedback-model';

import { resolveHintFocus } from './feedback-focus';

describe('resolveHintFocus', () => {
  /** Tres criterios: el primero cumplido, los otros dos no. */
  const criterios: FeedbackCriterion[] = [
    { description: 'Existe un h1', passed: true },
    { description: 'Existe un nav', passed: false },
    { description: 'Existe un footer', passed: false },
  ];

  it('traduce el número del modelo a índice de arreglo', () => {
    // El modelo cuenta desde 1 porque así se le numeran en el prompt; el segundo criterio es el 2.
    expect(resolveHintFocus({ criterio: 2 }, criterios)).toBe(1);
    expect(resolveHintFocus({ criterio: 3 }, criterios)).toBe(2);
  });

  /**
   * El caso plausible y por eso el peligroso: la pista sería sobre algo que el estudiante ya tiene
   * bien, y se pondría a "arreglarlo".
   */
  it('descarta un criterio que el estudiante ya cumple', () => {
    expect(resolveHintFocus({ criterio: 1 }, criterios)).toBeNull();
  });

  it('descarta un número fuera de rango', () => {
    expect(resolveHintFocus({ criterio: 9 }, criterios)).toBeNull();
    expect(resolveHintFocus({ criterio: 0 }, criterios)).toBeNull();
    expect(resolveHintFocus({ criterio: -1 }, criterios)).toBeNull();
  });

  /** El caso del tiempo agotado: no se comprobó ningún criterio, así que no hay cuál señalar. */
  it('acepta que no venga ninguno', () => {
    expect(resolveHintFocus({}, criterios)).toBeNull();
    expect(resolveHintFocus(null, criterios)).toBeNull();
  });

  /** El `responseSchema` promete un entero, pero la promesa la hace un modelo generativo. */
  it('descarta lo que no es un entero', () => {
    expect(resolveHintFocus({ criterio: 1.5 }, criterios)).toBeNull();
    expect(resolveHintFocus({ criterio: NaN }, criterios)).toBeNull();
    expect(resolveHintFocus({ criterio: '2' as unknown as number }, criterios)).toBeNull();
  });

  it('no señala nada cuando no hay criterios', () => {
    expect(resolveHintFocus({ criterio: 1 }, [])).toBeNull();
  });
});
