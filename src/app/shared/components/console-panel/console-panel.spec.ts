import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

import { ConsolePanel } from './console-panel';

describe('ConsolePanel', () => {
  let component: ConsolePanel;
  let fixture: ComponentFixture<ConsolePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsolePanel],
      // No es `providedIn: 'root'`: cada ejecutor de codigo tiene su propia instancia.
      providers: [CodeRunnerStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsolePanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('pinta una línea por mensaje', () => {
    const runner = TestBed.inject(CodeRunnerStateService);
    runner.addLog('hola');
    runner.addLog('adiós');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('.console-line').length).toBe(2);
    expect(element.querySelector('.console-empty')).toBeNull();
  });

  it('explica para qué sirve cuando no hay salida', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.console-empty')).not.toBeNull();
  });

  /** El botón vive aquí y no en la barra de cada vista: es una acción sobre lo que este panel pinta. */
  it('el botón de limpiar vacía la salida', () => {
    const runner = TestBed.inject(CodeRunnerStateService);
    runner.addLog('hola');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('.console-clear')!.click();
    fixture.detectChanges();

    expect(runner.logs()).toEqual([]);
    expect(element.querySelectorAll('.console-line').length).toBe(0);
  });

  /** Sin nada que limpiar, el botón no invita a pulsarlo. */
  it('deshabilita el botón cuando la consola está vacía', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector<HTMLButtonElement>('.console-clear')!.disabled).toBeTrue();
  });
});
