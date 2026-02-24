import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'playground',
    loadComponent: () =>
      import('@features/playground/pages/playground-page/playground-page').then(
        (m) => m.PlaygroundPage,
      ),
  },
];
