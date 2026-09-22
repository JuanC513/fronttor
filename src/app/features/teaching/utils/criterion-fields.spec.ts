import { CRITERION_TYPES, metaFor, suggestDescription, toCriterion } from './criterion-fields';

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

  describe('toCriterion', () => {
    it('descarta los campos que el tipo no usa', () => {
      // Pasa cuando se cambia el tipo de una fila: sin recortar, el atributo viejo acabaría en el
      // JSON que se guarda.
      const criterion = toCriterion({
        type: 'element_exists',
        description: 'Existe el saludo',
        selector: '#saludo',
        attribute: 'alt',
        property: 'display',
        value: 'sobra',
      });

      expect(criterion).toEqual({
        type: 'element_exists',
        description: 'Existe el saludo',
        selector: '#saludo',
      });
    });

    it('convierte a número el valor del conteo', () => {
      const criterion = toCriterion({
        type: 'element_count',
        description: 'Hay 3',
        selector: 'li',
        value: '3',
      });

      expect(criterion).toEqual({
        type: 'element_count',
        description: 'Hay 3',
        selector: 'li',
        value: 3,
      });
    });

    it('recorta los espacios de los campos escritos a mano', () => {
      const criterion = toCriterion({
        type: 'attribute_exists',
        description: '  Tiene alt  ',
        selector: ' img ',
        attribute: ' alt ',
      });

      expect(criterion).toEqual({
        type: 'attribute_exists',
        description: 'Tiene alt',
        selector: 'img',
        attribute: 'alt',
      });
    });

    it('produce cada uno de los siete tipos con su forma', () => {
      const shapes = CRITERION_TYPES.map((meta) =>
        Object.keys(
          toCriterion({
            type: meta.type,
            description: 'd',
            selector: 's',
            attribute: 'a',
            property: 'p',
            value: meta.value === 'number' ? 1 : 'v',
          }),
        ).sort(),
      );

      expect(shapes).toEqual([
        ['description', 'selector', 'type'],
        ['description', 'selector', 'type', 'value'],
        ['description', 'selector', 'type', 'value'],
        ['attribute', 'description', 'selector', 'type'],
        ['attribute', 'description', 'selector', 'type', 'value'],
        ['description', 'property', 'selector', 'type', 'value'],
        ['description', 'type', 'value'],
      ]);
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
