/** Espejo de `ContentPromptInput` en la Edge Function `generate-content`. */
export interface GenerateContentRequest {
  /** Nombre del módulo, para situar al modelo. */
  tema: string;

  /** Nombre del subtema. Acota de qué trata el bloque. */
  subtema: string;

  /** Título del bloque que se va a escribir. */
  nombreBloque: string;
  /** Nombres de los otros bloques del subtema, para que la IA no repita lo ya cubierto. */
  bloquesExistentes?: string[];
  /** Indicación libre del profesor sobre qué debe contener el bloque. */
  instruccion?: string;
  /** No entra en el prompt: es para que la interacción quede registrada con su subtema. */
  lessonId?: number;
}

/** Lo que devuelve `generate-content`. */
export interface GenerateContentResponse {
  /** El bloque redactado, en Markdown. */
  contenido: string;
}
