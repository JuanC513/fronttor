import { Routes } from '@angular/router';
import { AdminMain } from './pages/admin-main/admin-main';
import { ModuleFormDialog } from './components/module-form-dialog/module-form-dialog';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminMain,
    children: [
      { path: 'module/new', component: ModuleFormDialog },
      { path: 'module/edit/:id', component: ModuleFormDialog },
    ],
  },
  { path: '**', redirectTo: '' },
];
