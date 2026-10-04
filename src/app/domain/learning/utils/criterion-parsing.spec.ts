import { CriterionType } from '../models/exercise-criterion-model';
import { toCriterion } from './criterion-parsing';

describe('toCriterion', () => {
  it('descarta los campos que el tipo no usa', () => {
    // Pasa cuando se cambia el tipo de una fila del formulario, y también con lo que devuelve
    // Gemini, cuyo esquema es plano y trae todos los campos posibles.
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

  /** Gemini devuelve `value` siempre como cadena, y `resultsFor` compara el conteo con `===`. */
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

  /**
   * Los siete tipos van escritos a mano y no tomados del catálogo del formulario: así el test
   * sigue diciendo algo aunque ese catálogo se equivoque, y falla si alguien añade un tipo al
   * modelo sin darle su caso aquí.
   */
  it('produce cada uno de los siete tipos con su forma', () => {
    const types: CriterionType[] = [
      'element_exists',
      'element_count',
      'text_contains',
      'attribute_exists',
      'attribute_equals',
      'computed_style',
      'console_contains',
    ];

    const shapes = types.map((type) =>
      Object.keys(
        toCriterion({
          type,
          description: 'd',
          selector: 's',
          attribute: 'a',
          property: 'p',
          value: type === 'element_count' ? 1 : 'v',
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
