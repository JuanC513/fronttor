/** Espejo de `ContentPromptInput` en la Edge Function `generate-content`. */
export interface GenerateContentRequest {
  tema: string;
  subtema: string;
  nombreBloque: string;
  /** Nombres de los otros bloques del subtema, para que la IA no repita lo ya cubierto. */
  bloquesExistentes?: string[];
  /** Indicación libre del profesor sobre qué debe contener el bloque. */
  instruccion?: string;
}

export interface GenerateContentResponse {
  contenido: string;
}
