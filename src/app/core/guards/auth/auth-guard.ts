import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.initialized$.pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => {
      const user = authService.getCurrentUser();
      return user ? true : router.createUrlTree(['/login']);
    }),
  );
};
