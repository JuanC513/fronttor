import { Exercise } from './exercise-model';

/**
 * Ejercicio con el subtema y el tema a los que pertenece.
 *
 * El listado de administración muestra y filtra por ambos, y traerlos embebidos en la misma
 * consulta evita tener que cruzar tres listas en el componente.
 */
export interface ExerciseWithLesson extends Exercise {
  lessons: {
    id: number;
    name: string;
    is_published: boolean;
    module_id: number;
    modules: { id: number; name: string; is_published: boolean };
  };
}
