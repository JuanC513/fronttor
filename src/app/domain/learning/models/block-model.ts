/** Una pieza de contenido dentro de un subtema. Es la unidad que lee el estudiante. */
export interface Block {
  /** Clave primaria en `public.blocks`. */
  id: number;

  /** Titulo del bloque, visible en el indice del subtema. */
  name: string;

  /** El contenido en Markdown. */
  content: string;

  /** Posicion dentro del subtema. */
  order: number;

  /** Subtema al que pertenece. Borrarlo arrastra el bloque en cascada. */
  lesson_id: number;

  /**
   * Nace en borrador.
   *
   * Importa mas de lo que parece: si el primer subtema no tiene ningun bloque publicado,
   * `lesson_is_reachable` devuelve nulo y los intentos se evaluan pero no se guardan, sin aviso al
   * estudiante.
   */
  is_published: boolean;
}
