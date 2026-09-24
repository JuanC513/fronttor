import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { AiChatService } from '@domain/ai/services/ai-chat-service';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { ConfirmationService } from 'primeng/api';

import { PlaygroundPage } from './playground-page';
import { loadCode, saveCode } from '../../utils/playground-storage';

describe('PlaygroundPage', () => {
  let fixture: ComponentFixture<PlaygroundPage>;
  let component: PlaygroundPage;

  const setup = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlaygroundPage],
      // La vista publica contexto en `AiChatService`, que a su vez inyecta `AiService` y este
      // `SupabaseService`. Sin el doble se construiría un cliente de Supabase de verdad, con sus
      // bloqueos de sesión, y la zona nunca se estabilizaría.
      providers: [
        {
          provide: SupabaseService,
          useValue: { client: { functions: { invoke: () => Promise.resolve({ data: null }) } } },
        },
      ],
    });

    fixture = TestBed.createComponent(PlaygroundPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    return component;
  };

  /** `onClear` pide confirmación; la prueba acepta por el estudiante. */
  const acceptConfirmation = () => {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((options) => {
      options.accept?.();
      return confirmation;
    });
  };

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(setup()).toBeTruthy();
  });

  it('arranca en blanco cuando no hay nada guardado', () => {
    expect(setup().editableState()).toEqual({ html: '', css: '', js: '' });
  });

  /** Lo que justifica la persistencia: un F5 no puede borrar lo que llevabas escrito. */
  it('retoma el código guardado en el navegador', () => {
    saveCode({ html: '<h1>Hola</h1>', css: 'h1 { color: red }', js: '' });

    expect(setup().editableState()).toEqual({
      html: '<h1>Hola</h1>',
      css: 'h1 { color: red }',
      js: '',
    });
  });

  it('el interruptor cambia el modo de ejecución del motor', () => {
    const page = setup();
    const runner = fixture.debugElement.injector.get(CodeRunnerStateService);

    expect(runner.executionMode()).toBe('auto');

    page.onAutoRunChange(false);

    expect(runner.executionMode()).toBe('manual');
    expect(page.autoRun()).toBeFalse();
  });

  /**
   * En manual, el estado ejecutado solo se pone al día al pulsar. Es lo que permite escribir a
   * medias sin que el iframe se monte en cada tecla.
   */
  it('ejecutar pone al día lo que se está mostrando', () => {
    const page = setup();
    const runner = fixture.debugElement.injector.get(CodeRunnerStateService);

    page.onAutoRunChange(false);
    page.onCodeChange({ html: '<p>nuevo</p>', css: '', js: '' });
    expect(runner.executedState().html).toBe('');

    page.run();

    expect(runner.executedState().html).toBe('<p>nuevo</p>');
  });

  it('limpiar vacía el editor y lo guardado, tras confirmar', () => {
    saveCode({ html: '<h1>Hola</h1>', css: '', js: '' });
    const page = setup();
    acceptConfirmation();

    page.onClear();

    expect(page.editableState()).toEqual({ html: '', css: '', js: '' });
    expect(loadCode()).toBeNull();
  });

  /**
   * El botón del tutor en el topbar aparece solo si hay contexto publicado: sin esto, Libre no
   * tendría chat.
   */
  it('pone el taller a disposición del tutor', () => {
    setup();
    const chat = TestBed.inject(AiChatService);
    const context = chat.context();

    expect(context?.tipo).toBe('codigo');
    expect(context?.saludo).toContain('código');
  });

  /**
   * El contexto lleva las señales del motor, no una copia: lo que el tutor ve es lo que hay escrito
   * en el momento de preguntar, no lo que había al entrar a la vista.
   */
  it('el contexto del tutor sigue al editor', () => {
    const page = setup();
    const context = TestBed.inject(AiChatService).context();

    page.onCodeChange({ html: '<h1>Después</h1>', css: '', js: '' });

    expect(context?.tipo).toBe('codigo');
    expect(context?.tipo === 'codigo' && context.obtenerCodigo().html).toBe('<h1>Después</h1>');
  });

  /**
   * El chat se monta en `AppLayout`, fuera de este inyector, así que no se va solo: sin esta
   * limpieza el botón seguiría en el topbar de la siguiente vista, leyendo señales de un componente
   * ya destruido.
   */
  it('retira el contexto del tutor al salir de la vista', () => {
    setup();
    const chat = TestBed.inject(AiChatService);
    expect(chat.context()).not.toBeNull();

    fixture.destroy();

    expect(chat.context()).toBeNull();
  });

  /** Salir de la vista con una escritura pendiente no puede costarle el último cambio. */
  it('guarda lo pendiente al destruirse', () => {
    const page = setup();
    page.onCodeChange({ html: '<p>sin guardar</p>', css: '', js: '' });

    fixture.destroy();

    expect(loadCode()?.html).toBe('<p>sin guardar</p>');
  });
});
