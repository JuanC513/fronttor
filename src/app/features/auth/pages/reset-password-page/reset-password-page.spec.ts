import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { User } from '@supabase/supabase-js';
import { of } from 'rxjs';
import { ResetPasswordPage } from './reset-password-page';

describe('ResetPasswordPage', () => {
  let authService: jasmine.SpyObj<AuthService>;

  const setup = (user: User | null) => {
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['getCurrentUser', 'updatePassword', 'signOut'],
      { initialized$: of(true) },
    );
    authService.getCurrentUser.and.returnValue(user);

    TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [{ provide: AuthService, useValue: authService }, provideRouter([])],
    });

    const fixture: ComponentFixture<ResetPasswordPage> = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    expect(setup(null).componentInstance).toBeTruthy();
  });

  it('marca el enlace como inválido cuando no llegó ninguna sesión de recuperación', () => {
    const component = setup(null).componentInstance;

    expect(component.checkingLink()).toBeFalse();
    expect(component.linkIsValid()).toBeFalse();
  });

  it('acepta el enlace cuando sí hay sesión de recuperación', () => {
    const component = setup({} as User).componentInstance;

    expect(component.linkIsValid()).toBeTrue();
  });

  it('no guarda nada si las contraseñas no coinciden', async () => {
    const component = setup({} as User).componentInstance;
    component.resetForm.setValue({ password: 'unaClave123', confirmPassword: 'otraClave456' });

    await component.onSubmit();

    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it('cierra la sesión de recuperación tras guardar la contraseña nueva', async () => {
    // Cerrarla es intencional: obliga a entrar con la clave nueva, que es la comprobación real.
    const component = setup({} as User).componentInstance;
    authService.updatePassword.and.resolveTo();
    authService.signOut.and.resolveTo();
    component.resetForm.setValue({ password: 'unaClave123', confirmPassword: 'unaClave123' });

    await component.onSubmit();

    expect(authService.updatePassword).toHaveBeenCalledWith('unaClave123');
    expect(authService.signOut).toHaveBeenCalled();
    expect(component.passwordUpdated()).toBeTrue();
  });

  it('traduce el error cuando la contraseña nueva es igual a la anterior', async () => {
    const component = setup({} as User).componentInstance;
    authService.updatePassword.and.rejectWith({ code: 'same_password' });
    component.resetForm.setValue({ password: 'unaClave123', confirmPassword: 'unaClave123' });

    await component.onSubmit();

    expect(component.serverError()).toBe('La nueva contraseña debe ser distinta a la anterior.');
    expect(component.passwordUpdated()).toBeFalse();
  });
});
