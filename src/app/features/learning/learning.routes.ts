import { Routes } from '@angular/router';
import { LearningModules } from './pages/learning-modules/learning-modules';
import { LearningLesson } from './pages/learning-lesson/learning-lesson';
import { LearningExercises } from './pages/learning-exercises/learning-exercises';

export const LEARNING_ROUTES: Routes = [
  { path: 'modules', component: LearningModules },
  { path: 'exercises', component: LearningExercises },
  { path: 'modules/:moduleId/lessons/:lessonId', component: LearningLesson },
  { path: '**', redirectTo: 'modules' },
];
