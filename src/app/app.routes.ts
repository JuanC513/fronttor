import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { guestGuard } from '@core/guards/guest/guest-guard';
import { roleGuard } from '@core/guards/role/role-guard';
import { UserRole } from '@core/interfaces/profile';
import { AppLayout } from '@shared/layouts/app-layout/app-layout';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('@features/auth/pages/login-page/login-page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('@features/auth/pages/auth-callback-page/auth-callback-page').then(
        (m) => m.AuthCallbackPage,
      ),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('@features/auth/pages/reset-password-page/reset-password-page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadChildren: () => import('@features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: 'learning',
        canActivate: [roleGuard],
        data: { roles: ['student'] as UserRole[] },
        loadChildren: () =>
          import('@features/learning/learning.routes').then((m) => m.LEARNING_ROUTES),
      },
      {
        path: 'playground',
        loadChildren: () =>
          import('@features/playground/playground.routes').then((m) => m.PLAYGROUND_ROUTES),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('@features/profile/pages/profile-page/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'teaching',
        canActivate: [roleGuard],
        data: { roles: ['teacher'] as UserRole[] },
        loadChildren: () =>
          import('@features/teaching/teaching.routes').then((m) => m.TEACHING_ROUTES),
      },
      {
        path: '**',
        redirectTo: 'home',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
