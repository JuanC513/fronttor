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
  const buildProfile = (roles: UserRole[]): Profile => ({
    user_id: 'usuario-1',
    email: 'alguien@ejemplo.com',
    profile_description: null,
    roles,
  });

  /**
   * `initialized$` emite `false` antes que `true` a propósito: así era como se manifestaba el bug
   * que tenía este guard, que leía `profile$` sin esperar y veía el `null` inicial.
   */
  const runGuard = async (options: { profile: Profile | null; allowedRoles: UserRole[] }) => {
    // Se reinicia aquí y no solo en el `afterEach` para poder correr el guard varias veces dentro
    // de una misma prueba: `configureTestingModule` falla si el módulo ya está instanciado.
    TestBed.resetTestingModule();

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

  it('deja pasar a un profesor a una ruta de profesores', async () => {
    const result = await runGuard({
      profile: buildProfile(['teacher']),
      allowedRoles: ['teacher'],
    });

    expect(result).toBeTrue();
  });

  it('manda a /home a un estudiante que intenta entrar a una ruta de profesores', async () => {
    const result = await runGuard({
      profile: buildProfile(['student']),
      allowedRoles: ['teacher'],
    });

    expect(urlOf(result)).toBe('/home');
  });

  /**
   * El caso que justifica todo el cambio a varios roles: el profesor que administra el contenido
   * y además quiere verlo como lo ve un estudiante. Con un solo rol había que elegir.
   */
  it('deja pasar a quien tiene los dos roles por las dos puertas', async () => {
    const profile = buildProfile(['student', 'teacher']);

    expect(await runGuard({ profile, allowedRoles: ['teacher'] })).toBeTrue();
    expect(await runGuard({ profile, allowedRoles: ['student'] })).toBeTrue();
  });

  it('manda a /home a un perfil sin ningún rol', async () => {
    const result = await runGuard({ profile: buildProfile([]), allowedRoles: ['student'] });

    expect(urlOf(result)).toBe('/home');
  });

  it('manda a /login cuando no hay perfil cargado', async () => {
    const result = await runGuard({ profile: null, allowedRoles: ['teacher'] });

    expect(urlOf(result)).toBe('/login');
  });
});
