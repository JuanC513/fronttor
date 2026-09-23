import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  /**
   * Sustituye al `should render title` que generó el CLI, que esperaba el «Hello, tg-smart-tutor»
   * de la plantilla de ejemplo. Esa plantilla se reemplazó por el router hace mucho, así que el
   * test llevaba tiempo comprobando algo que la aplicación ya no hace a propósito.
   */
  it('monta el router en la raíz', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
