import { Routes } from '@angular/router';
import { LearningModules } from './pages/learning-modules/learning-modules';
import { LearningLesson } from './pages/learning-lesson/learning-lesson';

export const LEARNING_ROUTES: Routes = [
  { path: 'modules', component: LearningModules },
  { path: 'modules/:moduleId/lessons/:lessonId', component: LearningLesson },
  { path: '**', redirectTo: 'modules' },
];
