import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';

import { PreviewPanel } from './preview-panel';

/**
 * Estas pruebas montan un iframe de verdad y ejecutan dentro el código que se les pasa.
 *
 * Es la única forma de comprobar el motor de punta a punta: el iframe está en
 * `sandbox="allow-scripts"` sin `allow-same-origin`, así que su origen es opaco y nada de lo que
 * ocurre dentro se puede observar desde fuera salvo por los mensajes que él mismo envía. Karma
 * corre sobre un Chrome real, de modo que `computed_style` se comprueba con layout auténtico y no
 * contra una simulación.
 */
describe('PreviewPanel', () => {
  let component: PreviewPanel;
  let fixture: ComponentFixture<PreviewPanel>;
  let state: CodeRunnerStateService;

  const code = (over: Partial<CodeRunnerState> = {}): CodeRunnerState => ({
    html: '',
    css: '',
    js: '',
    ...over,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewPanel],
      // No es `providedIn: 'root'`: cada previsualizador tiene su propia instancia.
      providers: [CodeRunnerStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewPanel);
    component = fixture.componentInstance;
    state = TestBed.inject(CodeRunnerStateService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('runValidation', () => {
    it('comprueba estructura, texto y atributos sobre el DOM renderizado', async () => {
      const criteria: ExerciseCriterion[] = [
        { type: 'element_exists', selector: '#saludo', description: 'Existe el saludo' },
        { type: 'element_count', selector: 'li', value: 3, description: 'Hay 3 elementos' },
        { type: 'text_contains', selector: '#saludo', value: 'Hola', description: 'Dice Hola' },
        { type: 'attribute_exists', selector: 'img', attribute: 'alt', description: 'Tiene alt' },
      ];

      const outcome = await component.runValidation(
        code({
          html:
            '<p id="saludo">Hola mundo</p>' +
            '<ul><li>a</li><li>b</li><li>c</li></ul>' +
            '<img src="x.png" alt="Logo">',
        }),
        criteria,
      );

      expect(outcome.results.map((result) => result.passed)).toEqual([true, true, true, true]);
      expect(outcome.passed).toBeTrue();
      expect(outcome.timedOut).toBeFalse();
    });

    it('señala uno a uno los criterios que no se cumplen', async () => {
      const outcome = await component.runValidation(code({ html: '<p>algo</p>' }), [
        { type: 'element_exists', selector: 'p', description: 'Hay un párrafo' },
        { type: 'element_exists', selector: '#saludo', description: 'Existe el saludo' },
      ]);

      expect(outcome.results).toEqual([
        { description: 'Hay un párrafo', passed: true },
        { description: 'Existe el saludo', passed: false },
      ]);
      expect(outcome.passed).toBeFalse();
    });

    it('lee el estilo calculado con el layout real del navegador', async () => {
      const outcome = await component.runValidation(
        code({ html: '<div class="caja"></div>', css: '.caja { display: flex; color: red; }' }),
        [
          {
            type: 'computed_style',
            selector: '.caja',
            property: 'display',
            value: 'flex',
            description: 'Es flex',
          },
          {
            type: 'computed_style',
            selector: '.caja',
            property: 'color',
            // El navegador normaliza `red`; escribirlo tal cual en el criterio no casaría.
            value: 'rgb(255, 0, 0)',
            description: 'Es roja',
          },
        ],
      );

      expect(outcome.passed).toBeTrue();
    });

    it('ve el DOM que construye el JavaScript del estudiante', async () => {
      const js = 'document.getElementById("app").innerHTML = "<span class=\'hecho\'>listo</span>";';

      const outcome = await component.runValidation(code({ html: '<div id="app"></div>', js }), [
        { type: 'element_exists', selector: '.hecho', description: 'El script creó el span' },
      ]);

      expect(outcome.passed).toBeTrue();
    });

    it('captura la consola para los criterios que la miran', async () => {
      const outcome = await component.runValidation(code({ js: 'console.log(6 * 7);' }), [
        { type: 'console_contains', value: '42', description: 'Imprime 42' },
      ]);

      expect(outcome.passed).toBeTrue();
    });

    it('no aprueba un ejercicio sin criterios', async () => {
      const outcome = await component.runValidation(code({ html: '<p>algo</p>' }), []);

      expect(outcome.results).toEqual([]);
      expect(outcome.passed).toBeFalse();
    });

    it('un criterio con selector inválido no se cumple, en vez de romper la validación', async () => {
      const outcome = await component.runValidation(code({ html: '<p>algo</p>' }), [
        { type: 'element_exists', selector: '###', description: 'Selector mal escrito' },
        { type: 'element_exists', selector: 'p', description: 'Hay un párrafo' },
      ]);

      expect(outcome.results.map((result) => result.passed)).toEqual([false, true]);
    });

    it('un error de ejecución no impide comprobar el resto', async () => {
      const outcome = await component.runValidation(
        code({ html: '<p id="saludo">Hola</p>', js: 'noExiste();' }),
        [{ type: 'element_exists', selector: '#saludo', description: 'Existe el saludo' }],
      );

      expect(outcome.passed).toBeTrue();
      expect(state.logs().some((log) => log.includes('ERROR'))).toBeTrue();
    });

    it('abandona la validación anterior cuando llega otra', async () => {
      // Es también el camino del tiempo agotado: quien no recibe informe vuelve con todos los
      // criterios sin cumplir y `timedOut`, en lugar de dejar la promesa colgada para siempre.
      const criteria: ExerciseCriterion[] = [
        { type: 'element_exists', selector: 'p', description: 'Hay un párrafo' },
      ];

      const abandonada = component.runValidation(code({ html: '<p>a</p>' }), criteria);
      const vigente = component.runValidation(code({ html: '<p>b</p>' }), criteria);
      const [primera, segunda] = await Promise.all([abandonada, vigente]);

      expect(primera.timedOut).toBeTrue();
      expect(primera.results).toEqual([{ description: 'Hay un párrafo', passed: false }]);
      expect(segunda.passed).toBeTrue();
    });
  });

  describe('mensajes', () => {
    it('descarta los que no vienen de su iframe', () => {
      // `window:message` es global: cualquier ventana puede enviar algo con esta forma. Comparar
      // `event.source` es lo que impide que un mensaje ajeno se cuele como salida del código.
      component.onMessage(
        new MessageEvent('message', {
          data: { type: 'log', payload: ['inyectado desde fuera'] },
          source: window,
        }),
      );

      expect(state.logs()).toEqual([]);
    });
  });
});
