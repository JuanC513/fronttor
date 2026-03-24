import { Routes } from '@angular/router';
import { LearningPage } from './pages/learning-page/learning-page';
import { LearningModules } from './pages/learning-modules/learning-modules';

export const LEARNING_ROUTES: Routes = [
  { path: '', component: LearningModules },
  { path: 'prueba', component: LearningPage },
  { path: '**', redirectTo: '' },
];
