import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/guest/guest-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  {
    path: 'login',
    loadComponent: () =>
      import('@features/auth/pages/login-page/login-page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
  },

  // {
  //   path: 'register',
  //   loadComponent: () =>
  //     import('@features/auth/pages/register-page/register-page').then((m) => m.RegisterPage),
  // },

  {
    path: 'playground',
    loadComponent: () =>
      import('@features/playground/pages/playground-page/playground-page').then(
        (m) => m.PlaygroundPage,
      ),
    canActivate: [authGuard],
  },

  // {
  //   path: 'admin',
  //   loadComponent: () =>
  //     import('@features/admin/pages/admin-page/admin-page')
  //       .then(m => m.AdminPage),
  //   canActivate: [authGuard, roleGuard],
  //   data: { roles: ['admin'] },
  // },

  {
    path: '**',
    redirectTo: '',
  },
];
