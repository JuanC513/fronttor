import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@core/interfaces/profile';
import { AuthService } from '@core/services/auth/auth-service';
import { map } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as UserRole[];

  return authService.profile$.pipe(
    map((profile) => {
      if (!profile) {
        router.navigate(['/login']);
        return false;
      }

      if (allowedRoles.includes(profile.role)) {
        return true;
      }

      router.navigate(['/home']);
      return false;
    }),
  );
};
