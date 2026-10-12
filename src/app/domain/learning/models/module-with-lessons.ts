import { Lesson } from './lesson-model';
import { Module } from './module-model';

/**
 * Tema con sus subtemas embebidos.
 *
 * Es lo que pide el panel del profesor, que necesita el arbol entero para reordenar. La vista del
 * estudiante usa {@link ModuleWithLessonCounts}, que trae el recuento en vez de las filas.
 */
export interface ModuleWithLessons extends Module {
  /** Subtemas del tema, ya ordenados por `order`. */
  lessons: Lesson[];
}
