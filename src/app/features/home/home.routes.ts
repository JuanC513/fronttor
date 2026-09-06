import { Routes } from '@angular/router';
import { Dashboard } from './pages/dashboard/dashboard';

export const HOME_ROUTES: Routes = [
  { path: '', component: Dashboard },
  { path: '**', redirectTo: '' },
];
