import { CRITERION_TYPES, metaFor, suggestDescription } from './criterion-fields';

describe('criterion-fields', () => {
  describe('CRITERION_TYPES', () => {
    it('cubre el catálogo completo, sin repetir', () => {
      const types = CRITERION_TYPES.map((meta) => meta.type);
      expect(types.length).toBe(7);
      expect(new Set(types).size).toBe(7);
    });

    it('el conteo de elementos pide un número, no texto', () => {
      // `resultsFor` compara el valor con `===` contra el conteo: un «3» de texto nunca casaría.
      expect(metaFor('element_count').value).toBe('number');
      expect(metaFor('text_contains').value).toBe('text');
    });

    it('solo el criterio de consola no necesita selector', () => {
      const sinSelector = CRITERION_TYPES.filter((meta) => !meta.selector).map((m) => m.type);
      expect(sinSelector).toEqual(['console_contains']);
    });
  });

  describe('suggestDescription', () => {
    it('compone la descripción con los campos del tipo', () => {
      expect(
        suggestDescription({
          type: 'attribute_equals',
          selector: 'img',
          attribute: 'alt',
          value: 'Logo',
        }),
      ).toBe('El atributo «alt» de «img» es «Logo»');
    });

    it('no se rompe con los campos vacíos', () => {
      expect(suggestDescription({ type: 'element_exists' })).toBe('Existe un elemento «»');
    });
  });
});
