/** Un subtema: la unidad que el estudiante completa y que desbloquea la siguiente. */
export interface Lesson {
  /** Clave primaria en `public.lessons`. */
  id: number;

  /** Nombre del subtema, visible en el recorrido. */
  name: string;

  /** Posicion dentro del tema. Es lo que fija el orden en que se abren. */
  order: number;

  /** Tema al que pertenece. Borrarlo arrastra el subtema en cascada. */
  module_id: number;

  /** Nace en borrador; los no publicados no cuentan para el progreso. */
  is_published: boolean;
}
