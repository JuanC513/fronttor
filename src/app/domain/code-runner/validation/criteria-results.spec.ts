import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { hasPassed, resultsFor } from './criteria-results';
import { ProbeValue } from './probe-model';

/** Atajo: un solo criterio con su única respuesta. */
const check = (criterion: ExerciseCriterion, probe?: ProbeValue, logs: string[] = []): boolean =>
  resultsFor([criterion], probe ? [probe] : [], logs)[0].passed;

const found = (value: string | number | null): ProbeValue => ({ id: 0, found: true, value });
const missing: ProbeValue = { id: 0, found: false, value: null };

describe('resultsFor', () => {
  it('devuelve la descripción del criterio, que es lo que lee el estudiante', () => {
    const results = resultsFor(
      [{ type: 'element_exists', selector: '#x', description: 'Existe un elemento con id "x"' }],
      [found(1)],
      [],
    );

    expect(results).toEqual([{ description: 'Existe un elemento con id "x"', passed: true }]);
  });

  it('no da por cumplido un criterio cuya sonda no llegó', () => {
    // Ante la ausencia de respuesta no se puede afirmar nada, y el silencio no aprueba.
    expect(check({ type: 'element_exists', selector: '#x', description: 'x' })).toBeFalse();
  });

  describe('element_exists / element_count', () => {
    const exists: ExerciseCriterion = { type: 'element_exists', selector: 'p', description: 'p' };
    const count: ExerciseCriterion = {
      type: 'element_count',
      selector: 'li',
      value: 3,
      description: '3 li',
    };

    it('existe con al menos uno y falla con ninguno', () => {
      expect(check(exists, found(1))).toBeTrue();
      expect(check(exists, found(0))).toBeFalse();
    });

    it('el conteo es exacto, ni de más ni de menos', () => {
      expect(check(count, found(3))).toBeTrue();
      expect(check(count, found(2))).toBeFalse();
      expect(check(count, found(4))).toBeFalse();
    });
  });

  describe('text_contains', () => {
    const criterion: ExerciseCriterion = {
      type: 'text_contains',
      selector: '#saludo',
      value: 'Hola mundo',
      description: 'Saluda',
    };

    it('ignora saltos de línea y sangría del HTML', () => {
      expect(check(criterion, found('\n      Hola   mundo\n    '))).toBeTrue();
    });

    it('distingue mayúsculas: la descripción dice el texto exacto que se espera', () => {
      expect(check(criterion, found('hola mundo'))).toBeFalse();
    });

    it('falla si el elemento no existe, aunque se busque texto vacío', () => {
      const vacio: ExerciseCriterion = { ...criterion, value: '' };
      expect(check(vacio, missing)).toBeFalse();
    });
  });

  describe('attribute_exists / attribute_equals', () => {
    const exists: ExerciseCriterion = {
      type: 'attribute_exists',
      selector: 'img',
      attribute: 'alt',
      description: 'Tiene alt',
    };
    const equals: ExerciseCriterion = {
      type: 'attribute_equals',
      selector: 'img',
      attribute: 'alt',
      value: 'Logo',
      description: 'El alt es Logo',
    };

    it('un alt vacío existe: es HTML válido y deliberado para imágenes decorativas', () => {
      expect(check(exists, found(''))).toBeTrue();
    });

    it('un atributo ausente no existe', () => {
      expect(check(exists, found(null))).toBeFalse();
    });

    it('comparar contra vacío no puede aprobar un elemento inexistente', () => {
      // Es el motivo de que `found` viaje aparte del valor: sin él, `null === ''` no distingue
      // "no hay imagen" de "la imagen tiene el alt vacío".
      const vacio: ExerciseCriterion = { ...equals, value: '' };
      expect(check(vacio, missing)).toBeFalse();
    });

    it('la comparación es exacta', () => {
      expect(check(equals, found('Logo'))).toBeTrue();
      expect(check(equals, found('logo'))).toBeFalse();
    });
  });

  describe('computed_style', () => {
    const criterion: ExerciseCriterion = {
      type: 'computed_style',
      selector: '.caja',
      property: 'color',
      value: 'rgb(255, 0, 0)',
      description: 'Es roja',
    };

    it('compara contra el valor ya normalizado por el navegador', () => {
      expect(check(criterion, found('rgb(255, 0, 0)'))).toBeTrue();
    });

    it('el nombre del color no casa: es el error más común al escribir criterios', () => {
      expect(check({ ...criterion, value: 'red' }, found('rgb(255, 0, 0)'))).toBeFalse();
    });
  });

  describe('console_contains', () => {
    const criterion: ExerciseCriterion = {
      type: 'console_contains',
      value: '42',
      description: 'Imprime 42',
    };

    it('busca en cualquiera de las líneas impresas', () => {
      expect(check(criterion, undefined, ['hola', 'el resultado es 42'])).toBeTrue();
    });

    it('falla sin salida de consola, y no necesita ninguna sonda', () => {
      expect(check(criterion, undefined, [])).toBeFalse();
    });
  });
});

describe('hasPassed', () => {
  const criterion: ExerciseCriterion = { type: 'element_exists', selector: 'p', description: 'p' };

  it('aprueba solo con todos los criterios cumplidos', () => {
    expect(hasPassed([criterion], [{ description: 'p', passed: true }])).toBeTrue();
    expect(hasPassed([criterion], [{ description: 'p', passed: false }])).toBeFalse();
  });

  it('un ejercicio sin criterios nunca se aprueba', () => {
    // `every` sobre una lista vacía es cierto, así que sin esta regla un ejercicio a medio
    // escribir se daría por resuelto con solo abrirlo, y contaría para completar el subtema.
    expect(hasPassed([], [])).toBeFalse();
  });
});
