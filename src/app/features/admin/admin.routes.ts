import { Routes } from '@angular/router';
import { AdminMain } from './pages/admin-main/admin-main';

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminMain },
  { path: '**', redirectTo: '' },
];
