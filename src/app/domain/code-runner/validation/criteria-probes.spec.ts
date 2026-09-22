import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { probesFor } from './criteria-probes';

describe('probesFor', () => {
  it('empareja cada sonda con su criterio por el índice', () => {
    const criteria: ExerciseCriterion[] = [
      { type: 'console_contains', value: '42', description: 'Imprime 42' },
      { type: 'element_exists', selector: '#saludo', description: 'Existe el saludo' },
    ];

    // El primer criterio no genera sonda, así que la del segundo no puede quedar con id 0: el id
    // es el índice del criterio, no la posición en la lista de sondas.
    expect(probesFor(criteria)).toEqual([{ id: 1, kind: 'count', selector: '#saludo' }]);
  });

  it('resuelve existencia y conteo con la misma pregunta', () => {
    const probes = probesFor([
      { type: 'element_exists', selector: 'li', description: 'Hay lista' },
      { type: 'element_count', selector: 'li', value: 3, description: 'Hay 3' },
    ]);

    expect(probes).toEqual([
      { id: 0, kind: 'count', selector: 'li' },
      { id: 1, kind: 'count', selector: 'li' },
    ]);
  });

  it('pide el atributo tanto para comprobar que existe como para compararlo', () => {
    const probes = probesFor([
      { type: 'attribute_exists', selector: 'img', attribute: 'alt', description: 'Tiene alt' },
      {
        type: 'attribute_equals',
        selector: 'img',
        attribute: 'alt',
        value: 'Logo',
        description: 'El alt es Logo',
      },
    ]);

    expect(probes.every((probe) => probe.kind === 'attribute')).toBeTrue();
  });

  it('pide el estilo calculado con la propiedad del criterio', () => {
    expect(
      probesFor([
        {
          type: 'computed_style',
          selector: '.caja',
          property: 'display',
          value: 'flex',
          description: 'Es flex',
        },
      ]),
    ).toEqual([{ id: 0, kind: 'style', selector: '.caja', property: 'display' }]);
  });

  it('no pide nada al documento cuando todo se resuelve con la consola', () => {
    expect(probesFor([{ type: 'console_contains', value: 'hola', description: 'Saluda' }])).toEqual(
      [],
    );
  });
});
