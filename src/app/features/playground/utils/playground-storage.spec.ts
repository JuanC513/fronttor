import { clearCode, loadCode, saveCode } from './playground-storage';

describe('playground-storage', () => {
  const code = { html: '<h1>Hola</h1>', css: 'h1 { color: red }', js: 'console.log(1)' };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('devuelve lo mismo que se guardó', () => {
    saveCode(code);

    expect(loadCode()).toEqual(code);
  });

  it('devuelve null cuando no hay nada guardado', () => {
    expect(loadCode()).toBeNull();
  });

  it('olvida el código al limpiarlo', () => {
    saveCode(code);

    clearCode();

    expect(loadCode()).toBeNull();
  });

  /* ─── Lo guardado no es de fiar ─── */

  /**
   * Es una cadena que cualquiera puede editar desde las herramientas del navegador. Sin validar la
   * forma, un `{"html": 42}` acabaría dentro de Monaco y el fallo aparecería lejos de aquí.
   */
  it('descarta lo guardado si no tiene la forma del editor', () => {
    // Se guarda primero para averiguar la clave real sin duplicarla aquí: si cambia en el módulo,
    // esta prueba la sigue en vez de quedarse comprobando una entrada que ya nadie escribe.
    saveCode(code);
    const key = Object.keys(localStorage).find((k) => k.includes('playground'))!;

    localStorage.setItem(key, JSON.stringify({ html: 42, css: '', js: '' }));
    expect(loadCode()).toBeNull();

    localStorage.setItem(key, JSON.stringify({ html: 'solo html' }));
    expect(loadCode()).toBeNull();

    localStorage.setItem(key, JSON.stringify('una cadena suelta'));
    expect(loadCode()).toBeNull();

    localStorage.setItem(key, 'null');
    expect(loadCode()).toBeNull();
  });

  it('descarta un JSON corrupto en vez de propagar el error', () => {
    saveCode(code);
    const key = Object.keys(localStorage).find((k) => k.includes('playground'))!;
    localStorage.setItem(key, '{no es json');

    expect(() => loadCode()).not.toThrow();
    expect(loadCode()).toBeNull();
  });

  /* ─── Sin almacenamiento disponible ─── */

  /**
   * En ventana privada, con el almacenamiento del sitio bloqueado o lleno, estas llamadas
   * **lanzan**. El taller tiene que seguir funcionando; lo único que se pierde es la comodidad.
   */
  it('no propaga el error si el navegador no deja leer', () => {
    spyOn(localStorage, 'getItem').and.throwError('SecurityError');

    expect(() => loadCode()).not.toThrow();
    expect(loadCode()).toBeNull();
  });

  it('no propaga el error si el navegador no deja escribir', () => {
    spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');

    expect(() => saveCode(code)).not.toThrow();
  });

  it('no propaga el error si el navegador no deja borrar', () => {
    spyOn(localStorage, 'removeItem').and.throwError('SecurityError');

    expect(() => clearCode()).not.toThrow();
  });
});
