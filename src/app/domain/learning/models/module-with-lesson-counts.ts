import { Lesson } from './lesson-model';
import { Module } from './module-model';

/**
 * Subtema con el número de bloques que tiene.
 */
export interface LessonWithBlockCount extends Lesson {
  blocks: { count: number }[];
}

/** Árbol de contenido que consume la vista de estudiante para descartar lo que está vacío. */
export interface ModuleWithLessonCounts extends Module {
  lessons: LessonWithBlockCount[];
}
