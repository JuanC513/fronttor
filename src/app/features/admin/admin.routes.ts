import { Routes } from '@angular/router';
import { AdminModules } from './pages/admin-modules/admin-modules';

export const ADMIN_ROUTES: Routes = [
  { path: 'modules', component: AdminModules },
  { path: '**', redirectTo: '' },
];
