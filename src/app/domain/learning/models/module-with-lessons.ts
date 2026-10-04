import { Lesson } from './lesson-model';
import { Module } from './module-model';

export interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}
