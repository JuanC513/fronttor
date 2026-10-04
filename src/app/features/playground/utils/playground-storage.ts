import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';

/** Una sola clave: en Libre solo hay un taller y no hay nada que distinguir. */
const STORAGE_KEY = 'fronttor:playground:code';

/**
 * El código de Práctica libre, guardado en el navegador.
 *
 * Aquí no hay nada que calificar ni progreso que registrar, así que no tiene sentido llevarlo al
 * servidor: lo único que se busca es que un F5 no borre lo que llevabas escrito. Eso es exactamente
 * para lo que sirve `localStorage`, con la contrapartida asumida de que vive solo en ese navegador.
 *
 * **Todo va envuelto en `try/catch`.** No es precaución de más: en una ventana privada, con el
 * almacenamiento del sitio bloqueado o lleno, tanto leer como escribir **lanzan**. El taller tiene
 * que funcionar igual sin almacenamiento; lo único que se pierde entonces es la comodidad.
 *
 * Funciones sueltas y no un servicio porque no necesitan inyección, y así se prueban sin `TestBed`.
 * Es el mismo criterio que `learning-progress.ts` o `publication-state.ts`.
 */

/** Si lo guardado tiene de verdad la forma del estado del editor. */
function isCodeRunnerState(value: unknown): value is CodeRunnerState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['html'] === 'string' &&
    typeof candidate['css'] === 'string' &&
    typeof candidate['js'] === 'string'
  );
}

/**
 * Devuelve el código guardado, o `null` si no hay ninguno utilizable.
 *
 * Se valida la forma antes de devolverlo porque esto es una cadena que cualquiera puede editar
 * desde las herramientas del navegador. Sin comprobarlo, un `{"html": 42}` acabaría dentro de
 * Monaco y el fallo aparecería lejos de aquí.
 */
export function loadCode(): CodeRunnerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isCodeRunnerState(parsed)) return null;

    return { html: parsed.html, css: parsed.css, js: parsed.js };
  } catch {
    // JSON corrupto, almacenamiento bloqueado o inaccesible: se empieza en blanco.
    return null;
  }
}

export function saveCode(code: CodeRunnerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    // Sin sitio o sin permiso. No hay nada que el estudiante pueda hacer al respecto y su código
    // sigue en pantalla, así que no se le interrumpe con un aviso.
  }
}

export function clearCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Igual que arriba: si no se puede tocar el almacenamiento, no se puede y ya está.
  }
}
