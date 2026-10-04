import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { User } from '@supabase/supabase-js';
import { of } from 'rxjs';
import { AuthCallbackPage } from './auth-callback-page';

describe('AuthCallbackPage', () => {
  let router: jasmine.SpyObj<Router>;

  /**
   * `initialized$` se pasa como propiedad del spy porque el guard de esta página no llama a un
   * método: espera a que AuthService termine de resolver la sesión que dejó el redirect.
   */
  const setup = (options: { user: User | null; errorDescription?: string }) => {
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser'], {
      initialized$: of(true),
    });
    authService.getCurrentUser.and.returnValue(options.user);

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [AuthCallbackPage],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(
                options.errorDescription ? { error_description: options.errorDescription } : {},
              ),
            },
          },
        },
      ],
    });

    const fixture: ComponentFixture<AuthCallbackPage> = TestBed.createComponent(AuthCallbackPage);
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    expect(setup({ user: null }).componentInstance).toBeTruthy();
  });

  it('entra a /home cuando el redirect dejó una sesión válida', () => {
    const fixture = setup({ user: {} as User });

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(fixture.componentInstance.errorMessage()).toBeNull();
  });

  it('avisa y no navega cuando no se estableció ninguna sesión', () => {
    const fixture = setup({ user: null });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorMessage()).toContain('expiró');
  });

  it('corta antes de esperar la sesión si el proveedor devolvió un error', () => {
    const fixture = setup({ user: null, errorDescription: 'access_denied' });

    expect(fixture.componentInstance.errorMessage()).toContain('No pudimos completar');
  });
});
