import { Routes } from '@angular/router';

/**
 * Las dos caras de la práctica: el taller en blanco y el ejercicio que el estudiante se pide.
 *
 * Sin `roleGuard`: practicar es de los dos roles, igual que hasta ahora. Un profesor que quiera ver
 * qué recibe su estudiante entra por el mismo sitio.
 */
export const PLAYGROUND_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/playground-page/playground-page').then((m) => m.PlaygroundPage),
  },
  {
    path: 'practice',
    loadComponent: () =>
      import('./pages/practice-exercise/practice-exercise').then((m) => m.PracticeExercise),
  },
  { path: '**', redirectTo: '' },
];
