/** Un tema: el nivel mas alto del recorrido, que agrupa subtemas. */
export interface Module {
  /** Clave primaria en `public.modules`. */
  id: number;

  /** Nombre del tema. */
  name: string;

  /** Posicion en el recorrido. */
  order: number;

  /** Nace en borrador; los no publicados no aparecen al estudiante. */
  is_published: boolean;
}
