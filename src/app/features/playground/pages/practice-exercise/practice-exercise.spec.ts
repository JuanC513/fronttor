import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AiService } from '@domain/ai/services/ai-service';
import { ValidationOutcome } from '@domain/code-runner/validation/probe-model';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { ModuleService } from '@domain/learning/services/module-service';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';

import { PracticeExercise } from './practice-exercise';

describe('PracticeExercise', () => {
  let fixture: ComponentFixture<PracticeExercise>;
  let component: PracticeExercise;
  let generatePractice: jasmine.Spy;
  let generateFeedback: jasmine.Spy;
  let runValidation: jasmine.Spy;

  const tree: ModuleWithLessonCounts[] = [
    {
      id: 1,
      name: 'HTML: Estructura',
      order: 1,
      is_published: true,
      lessons: [
        {
          id: 10,
          name: 'Etiquetas básicas',
          order: 1,
          module_id: 1,
          is_published: true,
          blocks: [],
        },
        { id: 11, name: 'Semántica', order: 2, module_id: 1, is_published: true, blocks: [] },
      ],
    },
  ];

  /** El ejercicio tal y como llega del modelo, con la lista plana de criterios. */
  const practice = (descripciones: string[]) => ({
    titulo: 'Un ejercicio',
    enunciado: 'Haz esto y lo otro',
    inicial: { html: '<div></div>', css: '', js: '' },
    solucion: { html: '<h1>Hola</h1>', css: '', js: '' },
    criterios: descripciones.map((description, index) => ({
      type: 'element_exists',
      description,
      selector: `#c${index}`,
    })),
  });

  /** Una validación con el resultado que se quiera para cada criterio. */
  const outcome = (descripciones: string[], passed: boolean[]): ValidationOutcome => ({
    results: descripciones.map((description, index) => ({
      description,
      passed: passed[index] ?? false,
    })),
    passed: passed.every(Boolean),
    timedOut: false,
  });

  /**
   * Encola los resultados de las validaciones.
   *
   * `checkCriteria` llama SIEMPRE en este orden: primero el código inicial, después la solución.
   * Cada par de entradas es una comprobación completa.
   */
  const queueValidations = (...outcomes: ValidationOutcome[]) => {
    runValidation.and.returnValues(...outcomes.map((o) => Promise.resolve(o)));
  };

  const setup = async () => {
    TestBed.configureTestingModule({
      imports: [PracticeExercise],
      providers: [
        provideRouter([]),
        { provide: AiService, useValue: { generatePractice, generateFeedback } },
        { provide: ModuleService, useValue: { getLearningTree: () => Promise.resolve(tree) } },
      ],
    });

    fixture = TestBed.createComponent(PracticeExercise);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    // El panel vive en el DOM desde el principio —aparcado fuera de pantalla— justo para que la
    // comprobación pueda correr antes de que haya ejercicio que mostrar.
    const panel = fixture.debugElement.query(By.directive(PreviewPanel))
      .componentInstance as PreviewPanel;
    runValidation = spyOn(panel, 'runValidation');

    component.lessonId.set(10);
    return component;
  };

  beforeEach(() => {
    generatePractice = jasmine.createSpy('generatePractice');
    generateFeedback = jasmine
      .createSpy('generateFeedback')
      .and.resolveTo({ criterio: 2, pista: 'Mira el segundo criterio.' });
    runValidation = jasmine.createSpy('runValidation');
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    expect(await setup()).toBeTruthy();
  });

  it('ofrece los subtemas publicados, agrupados por módulo', async () => {
    await setup();

    expect(component.lessonGroups()).toEqual([
      {
        label: 'HTML: Estructura',
        items: [
          { label: 'Etiquetas básicas', value: 10, tema: 'HTML: Estructura' },
          { label: 'Semántica', value: 11, tema: 'HTML: Estructura' },
        ],
      },
    ]);
  });

  /** El camino bueno: los criterios salen bien a la primera y no se gasta una segunda llamada. */
  it('no repara nada si los criterios ya están bien planteados', async () => {
    await setup();
    const descripciones = ['Uno', 'Dos'];

    generatePractice.and.resolveTo({ resultado: practice(descripciones) });
    queueValidations(
      outcome(descripciones, [false, false]), // el inicial no cumple ninguno
      outcome(descripciones, [true, true]), // la solución los cumple todos
    );

    await component.generate();

    expect(generatePractice).toHaveBeenCalledTimes(1);
    expect(component.phase()).toBe('resolver');
    expect(component.criteria().map((c) => c.description)).toEqual(descripciones);
    expect(component.discarded()).toBe(0);
  });

  /**
   * El corazón de la vista: un criterio que ni la propia solución cumple deja el ejercicio
   * imposible de aprobar, y el estudiante no tiene con qué arreglarlo.
   */
  it('vuelve a pedir los criterios cuando alguno no está bien planteado', async () => {
    await setup();
    const primeros = ['Uno', 'Dos'];
    const reparados = ['Uno', 'Dos corregido'];

    generatePractice.and.returnValues(
      Promise.resolve({ resultado: practice(primeros) }),
      Promise.resolve({
        resultado: reparados.map((description, index) => ({
          type: 'element_exists',
          description,
          selector: `#c${index}`,
        })),
      }),
    );

    queueValidations(
      outcome(primeros, [false, false]),
      outcome(primeros, [true, false]), // el segundo falla con la solución
      outcome(reparados, [false, false]),
      outcome(reparados, [true, true]), // ya cumple
    );

    await component.generate();

    expect(generatePractice).toHaveBeenCalledTimes(2);

    // Al modelo se le manda el veredicto, no solo "está mal": arreglar un criterio que la solución
    // no cumple y uno que el inicial ya cumple son dos cosas distintas.
    const repairRequest = generatePractice.calls.argsFor(1)[0];
    expect(repairRequest.modo).toBe('criterios');
    expect(repairRequest.diagnostico[0].veredicto).toBe('ok');
    expect(repairRequest.diagnostico[1].veredicto).toBe('fails_solution');
    expect(repairRequest.enunciado).toBe('Haz esto y lo otro');

    expect(component.criteria().map((c) => c.description)).toEqual(reparados);
    expect(component.discarded()).toBe(0);
  });

  /** Si la reparación no basta, mejor un ejercicio que comprueba menos que uno imposible. */
  it('descarta los criterios que siguen mal después de reparar', async () => {
    await setup();
    const descripciones = ['Uno', 'Dos'];

    generatePractice.and.returnValues(
      Promise.resolve({ resultado: practice(descripciones) }),
      Promise.resolve({ resultado: practice(descripciones).criterios }),
    );

    queueValidations(
      outcome(descripciones, [false, false]),
      outcome(descripciones, [true, false]),
      outcome(descripciones, [false, false]),
      outcome(descripciones, [true, false]), // el segundo sigue fallando
    );

    await component.generate();

    expect(component.phase()).toBe('resolver');
    expect(component.criteria().map((c) => c.description)).toEqual(['Uno']);
    expect(component.discarded()).toBe(1);
  });

  /** Sin un solo criterio sano no hay ejercicio: aprobarlo sería imposible. */
  it('no entrega el ejercicio si no queda ningún criterio sano', async () => {
    await setup();
    const descripciones = ['Uno'];

    generatePractice.and.returnValues(
      Promise.resolve({ resultado: practice(descripciones) }),
      Promise.resolve({ resultado: practice(descripciones).criterios }),
    );

    queueValidations(
      outcome(descripciones, [false]),
      outcome(descripciones, [false]),
      outcome(descripciones, [false]),
      outcome(descripciones, [false]),
    );

    await component.generate();

    expect(component.exercise()).toBeNull();
    expect(component.phase()).toBe('pedir');
    expect(component.error()).toContain('no salió bien');
  });

  it('avisa si el ejercicio llega incompleto', async () => {
    await setup();
    generatePractice.and.resolveTo({ resultado: { titulo: 'Solo el título' } });

    await component.generate();

    expect(component.exercise()).toBeNull();
    expect(component.phase()).toBe('pedir');
    expect(component.error()).toContain('incompleto');
  });

  describe('resolviendo', () => {
    const descripciones = ['Uno', 'Dos'];

    beforeEach(async () => {
      await setup();
      generatePractice.and.resolveTo({ resultado: practice(descripciones) });
      queueValidations(
        outcome(descripciones, [false, false]),
        outcome(descripciones, [true, true]),
      );
      await component.generate();
    });

    it('arranca con el código inicial del ejercicio', () => {
      expect(component.code().html).toBe('<div></div>');
    });

    it('comprobar cruza el código con los criterios', async () => {
      queueValidations(outcome(descripciones, [true, false]));

      await component.check();

      expect(component.criteria().map((c) => c.passed)).toEqual([true, false]);
      expect(component.resultMessage()?.severity).toBe('error');
    });

    describe('la pista del tutor', () => {
      /** Antes de comprobar, el tutor no tendria sobre que opinar. */
      it('no se ofrece hasta que algo falla', async () => {
        expect(component.canAskHelp()).toBeFalse();

        queueValidations(outcome(descripciones, [true, true]));
        await component.check();
        expect(component.canAskHelp()).toBeFalse();

        queueValidations(outcome(descripciones, [true, false]));
        await component.check();
        expect(component.canAskHelp()).toBeTrue();
      });

      it('señala el criterio que la pista indica', async () => {
        queueValidations(outcome(descripciones, [true, false]));
        await component.check();

        await component.askForHelp();

        // `criterio: 2` viene 1-indexado, como se le presentan al modelo.
        expect(component.criteria().map((c) => c.focused)).toEqual([false, true]);
        expect(component.hint()?.pista).toBe('Mira el segundo criterio.');
      });

      /**
       * Lo que justifica congelar el codigo al comprobar: entre comprobar y pedir ayuda el
       * estudiante sigue escribiendo, y la pista tiene que hablar del codigo que produjo los
       * criterios en rojo que tiene delante.
       */
      it('habla del código que se comprobó, no del que hay ahora en el editor', async () => {
        component.onCodeChange({ html: '<p>comprobado</p>', css: '', js: '' });
        queueValidations(outcome(descripciones, [true, false]));
        await component.check();

        component.onCodeChange({ html: '<p>escrito despues</p>', css: '', js: '' });
        await component.askForHelp();

        expect(generateFeedback.calls.mostRecent().args[0].html).toBe('<p>comprobado</p>');
      });

      /** El ejercicio no existe en la base, asi que no hay id al que apuntar. */
      it('pide la pista sin id de ejercicio', async () => {
        queueValidations(outcome(descripciones, [true, false]));
        await component.check();

        await component.askForHelp();

        const request = generateFeedback.calls.mostRecent().args[0];
        expect(request.exerciseId).toBeUndefined();
        expect(request.enunciado).toBe('Haz esto y lo otro');
        expect(request.criterios).toEqual([
          { description: 'Uno', passed: true },
          { description: 'Dos', passed: false },
        ]);
      });

      /** Una pista por comprobacion: otro clic seria otra llamada sobre el mismo codigo. */
      it('deja de ofrecerse hasta la siguiente comprobación', async () => {
        queueValidations(outcome(descripciones, [true, false]));
        await component.check();
        await component.askForHelp();

        expect(component.canAskHelp()).toBeFalse();

        queueValidations(outcome(descripciones, [true, false]));
        await component.check();

        // La pista anterior hablaba del codigo anterior: se va con el.
        expect(component.hint()).toBeNull();
        expect(component.canAskHelp()).toBeTrue();
      });

      it('un fallo del modelo deja volver a intentarlo', async () => {
        queueValidations(outcome(descripciones, [true, false]));
        await component.check();
        generateFeedback.and.rejectWith(new Error('El modelo está saturado'));

        await component.askForHelp();

        expect(component.helpError()).toContain('saturado');
        expect(component.canAskHelp()).toBeTrue();
      });
    });

    /** No hay intento que guardar: esto no califica ni cuenta para el progreso. */
    it('pedir otro ejercicio borra el anterior sin dejar rastro', () => {
      component.startOver();

      expect(component.exercise()).toBeNull();
      expect(component.outcome()).toBeNull();
      expect(component.code()).toEqual({ html: '', css: '', js: '' });
      expect(component.phase()).toBe('pedir');
    });
  });
});
