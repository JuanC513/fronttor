import { ExerciseWithoutSolution } from './exercise-model';

/**
 * Ejercicio con el subtema y el tema a los que pertenece.
 *
 * El listado del profesor muestra y filtra por ambos, y traerlos embebidos en la misma
 * consulta evita tener que cruzar tres listas en el componente.
 *
 * Sin la solucion de referencia: el listado no la necesita y la API ya no la entrega.
 */
export interface ExerciseWithLesson extends ExerciseWithoutSolution {
  /** Subtema del ejercicio, con su tema anidado dentro. */
  lessons: {
    id: number;
    name: string;
    is_published: boolean;
    module_id: number;
    modules: { id: number; name: string; is_published: boolean };
  };
}
