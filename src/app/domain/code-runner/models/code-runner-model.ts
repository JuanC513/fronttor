/**
 * Las tres pestañas del editor, que es la unidad con la que se mueve el código por toda la app.
 *
 * Viaja igual al previsualizador, al validador, al tutor y a la base al guardar un intento.
 */
export interface CodeRunnerState {
  /** Contenido de la pestaña HTML. */
  html: string;

  /** Contenido de la pestaña CSS. */
  css: string;

  /** Contenido de la pestaña JS. */
  js: string;
}

export type ExecutionMode = 'auto' | 'manual';
