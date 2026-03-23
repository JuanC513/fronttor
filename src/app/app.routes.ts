import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/guest/guest-guard';
import { AppLayout } from '@shared/layouts/app-layout/app-layout';

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
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'learning',
        loadComponent: () =>
          import('@features/learning/pages/learning-page/learning-page').then(
            (m) => m.LearningPage,
          ),
      },
      {
        path: 'playground',
        loadComponent: () =>
          import('@features/playground/pages/playground-page/playground-page').then(
            (m) => m.PlaygroundPage,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('@features/profile/pages/profile-page/profile-page').then((m) => m.ProfilePage),
      },
    ],
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
