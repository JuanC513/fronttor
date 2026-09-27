import { Routes } from '@angular/router';
import { LearningModules } from './pages/learning-modules/learning-modules';
import { LearningLesson } from './pages/learning-lesson/learning-lesson';
import { LearningExercises } from './pages/learning-exercises/learning-exercises';
import { LearningExercise } from './pages/learning-exercise/learning-exercise';
import { lessonReachableGuard } from './guards/lesson-reachable-guard';

export const LEARNING_ROUTES: Routes = [
  { path: 'modules', component: LearningModules },
  { path: 'exercises', component: LearningExercises },
  // Singular: la página de UN ejercicio, igual que `learning-lesson` lo es de un subtema. Va
  // después de `exercises` porque el router resuelve por orden y `:exerciseId` capturaría esa ruta.
  { path: 'exercises/:exerciseId', component: LearningExercise },
  // El guard evita mostrar un subtema al que el estudiante no ha llegado. Quien de verdad lo impide
  // es la base, que se niega a registrar progreso fuera de orden.
  {
    path: 'modules/:moduleId/lessons/:lessonId',
    component: LearningLesson,
    canActivate: [lessonReachableGuard],
  },
  { path: '**', redirectTo: 'modules' },
];
