import { CanActivateFn } from '@angular/router';

export const roleGuard: CanActivateFn = (/* route: ActivatedRouteSnapshot */) => {
  return true;
  // const authService = inject(AuthService);
  // const router = inject(Router);

  // const allowedRoles = route.data['roles'] as string[];

  // return authService.profile$.pipe(
  //   map((profile) => {
  //     if (!profile) {
  //       router.navigate(['/login']);
  //       return false;
  //     }

  //     if (allowedRoles.includes(profile.role)) {
  //       return true;
  //     }

  //     router.navigate(['/']);
  //     return false;
  //   }),
  // );
};
