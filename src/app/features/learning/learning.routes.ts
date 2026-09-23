import { Routes } from '@angular/router';
import { LearningModules } from './pages/learning-modules/learning-modules';
import { LearningLesson } from './pages/learning-lesson/learning-lesson';
import { LearningExercises } from './pages/learning-exercises/learning-exercises';
import { LearningExercise } from './pages/learning-exercise/learning-exercise';

export const LEARNING_ROUTES: Routes = [
  { path: 'modules', component: LearningModules },
  { path: 'exercises', component: LearningExercises },
  // Singular: la página de UN ejercicio, igual que `learning-lesson` lo es de un subtema. Va
  // después de `exercises` porque el router resuelve por orden y `:exerciseId` capturaría esa ruta.
  { path: 'exercises/:exerciseId', component: LearningExercise },
  { path: 'modules/:moduleId/lessons/:lessonId', component: LearningLesson },
  { path: '**', redirectTo: 'modules' },
];
