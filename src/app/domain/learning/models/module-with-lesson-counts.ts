import { Lesson } from './lesson-model';
import { Module } from './module-model';

/**
 * Subtema con el número de bloques que tiene.
 */
export interface LessonWithBlockCount extends Lesson {
  /**
   * Viene como lista de un elemento porque es la forma en que PostgREST devuelve un agregado
   * sobre la relación. No son los bloques: es solo cuántos hay.
   */
  blocks: { count: number }[];
}

/** Árbol de contenido que consume la vista de estudiante para descartar lo que está vacío. */
export interface ModuleWithLessonCounts extends Module {
  /** Subtemas del tema, cada uno con su recuento de bloques. */
  lessons: LessonWithBlockCount[];
}
