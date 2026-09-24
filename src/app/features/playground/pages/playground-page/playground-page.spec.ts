import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';
import { ConfirmationService } from 'primeng/api';

import { PlaygroundPage } from './playground-page';
import { loadCode, saveCode } from '../../utils/playground-storage';

describe('PlaygroundPage', () => {
  let fixture: ComponentFixture<PlaygroundPage>;
  let component: PlaygroundPage;

  const setup = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PlaygroundPage] });

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

  /** Salir de la vista con una escritura pendiente no puede costarle el último cambio. */
  it('guarda lo pendiente al destruirse', () => {
    const page = setup();
    page.onCodeChange({ html: '<p>sin guardar</p>', css: '', js: '' });

    fixture.destroy();

    expect(loadCode()?.html).toBe('<p>sin guardar</p>');
  });
});
