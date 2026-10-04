import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@core/interfaces/profile';
import { AuthService } from '@core/services/auth/auth-service';
import { filter, map, take } from 'rxjs/operators';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as UserRole[];

  // Se espera a `initialized$` (que solo emite `true` cuando el perfil ya se cargó) en vez de
  // suscribirse a `profile$` directamente
  return authService.initialized$.pipe(
    filter(Boolean),
    take(1),
    map(() => {
      const profile = authService.getCurrentProfile();

      if (!profile) {
        return router.createUrlTree(['/login']);
      }

      // Basta con tener uno de los roles permitidos. Un usuario con `['student', 'teacher']` pasa
      // tanto el guard de la vista de aprendizaje como el de enseñanza.
      if (allowedRoles.some((role) => profile.roles.includes(role))) {
        return true;
      }

      return router.createUrlTree(['/home']);
    }),
  );
};
