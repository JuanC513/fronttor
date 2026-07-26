import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Profile, UserRole } from '@core/interfaces/profile';
import { AuthService } from '@core/services/auth/auth-service';
import { firstValueFrom, isObservable, of } from 'rxjs';

import { roleGuard } from './role-guard';

describe('roleGuard', () => {
  const buildProfile = (role: UserRole): Profile => ({
    user_id: 'usuario-1',
    email: 'alguien@ejemplo.com',
    profile_description: null,
    role_id: role === 'admin' ? 1 : 2,
    role,
  });

  /**
   * `initialized$` emite `false` antes que `true` a propósito: así era como se manifestaba el bug
   * que tenía este guard, que leía `profile$` sin esperar y veía el `null` inicial.
   */
  const runGuard = async (options: { profile: Profile | null; allowedRoles: UserRole[] }) => {
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentProfile'], {
      initialized$: of(false, true),
    });
    authService.getCurrentProfile.and.returnValue(options.profile);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    });

    const route = { data: { roles: options.allowedRoles } } as unknown as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => roleGuard(route, state));

    return isObservable(result) ? await firstValueFrom(result) : await result;
  };

  const urlOf = (result: GuardResult) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : null;

  afterEach(() => TestBed.resetTestingModule());

  it('deja pasar a un admin a una ruta de admins', async () => {
    const result = await runGuard({ profile: buildProfile('admin'), allowedRoles: ['admin'] });

    expect(result).toBeTrue();
  });

  it('manda a /home a un estudiante que intenta entrar a una ruta de admins', async () => {
    const result = await runGuard({ profile: buildProfile('student'), allowedRoles: ['admin'] });

    expect(urlOf(result)).toBe('/home');
  });

  it('manda a /login cuando no hay perfil cargado', async () => {
    const result = await runGuard({ profile: null, allowedRoles: ['admin'] });

    expect(urlOf(result)).toBe('/login');
  });
});
