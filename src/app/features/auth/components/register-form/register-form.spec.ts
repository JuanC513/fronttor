import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { Session } from '@supabase/supabase-js';
import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  let component: RegisterForm;
  let fixture: ComponentFixture<RegisterForm>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const fillValidForm = () =>
    component.registerForm.setValue({
      email: 'nuevo@ejemplo.com',
      password: 'unaClave123',
      confirmPassword: 'unaClave123',
    });

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['signUp']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegisterForm],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rechaza contraseñas más cortas que el mínimo', () => {
    component.registerForm.setValue({
      email: 'nuevo@ejemplo.com',
      password: 'corta',
      confirmPassword: 'corta',
    });

    expect(component.registerForm.controls.password.hasError('minlength')).toBeTrue();
  });

  it('rechaza el envío si las contraseñas no coinciden', async () => {
    component.registerForm.setValue({
      email: 'nuevo@ejemplo.com',
      password: 'unaClave123',
      confirmPassword: 'otraClave456',
    });

    await component.onSubmit();

    expect(component.registerForm.hasError('passwordsMismatch')).toBeTrue();
    expect(authService.signUp).not.toHaveBeenCalled();
  });

  it('muestra el aviso de confirmación cuando Supabase no devuelve sesión', async () => {
    // Es el caso con "Confirm email" activo: la cuenta queda pendiente de confirmar por correo.
    authService.signUp.and.resolveTo({ user: null, session: null });
    fillValidForm();

    await component.onSubmit();

    expect(component.confirmationSent()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('entra directo a /home cuando Supabase sí devuelve sesión', async () => {
    // Ocurre si la confirmación por correo está desactivada en el proyecto de Supabase.
    authService.signUp.and.resolveTo({ user: null, session: {} as Session });
    fillValidForm();

    await component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.confirmationSent()).toBeFalse();
  });

  it('traduce el error del servidor', async () => {
    authService.signUp.and.rejectWith({ code: 'user_already_exists' });
    fillValidForm();

    await component.onSubmit();

    expect(component.serverError()).toBe('Ya existe una cuenta con este correo.');
  });
});
