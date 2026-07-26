import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { Session, User } from '@supabase/supabase-js';
import { LoginForm } from './login-form';

describe('LoginForm', () => {
  let component: LoginForm;
  let fixture: ComponentFixture<LoginForm>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    // El AuthService real construye un cliente de Supabase en su constructor; se mockea para que
    // el test no salga a la red.
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['signIn']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginForm],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no intenta iniciar sesión con el formulario vacío', async () => {
    await component.onSubmit();

    expect(authService.signIn).not.toHaveBeenCalled();
    expect(component.loginForm.controls.email.touched).toBeTrue();
  });

  it('exige un correo con formato válido', () => {
    component.loginForm.patchValue({ email: 'no-es-un-correo', password: 'unaClave123' });

    expect(component.loginForm.invalid).toBeTrue();
  });

  it('navega a /home cuando las credenciales son correctas', async () => {
    authService.signIn.and.resolveTo({ user: {} as User, session: {} as Session });
    component.loginForm.setValue({ email: 'alguien@ejemplo.com', password: 'unaClave123' });

    await component.onSubmit();

    expect(authService.signIn).toHaveBeenCalledWith('alguien@ejemplo.com', 'unaClave123');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.serverError()).toBeNull();
  });

  it('muestra el mensaje traducido y no navega cuando las credenciales fallan', async () => {
    authService.signIn.and.rejectWith({ code: 'invalid_credentials' });
    component.loginForm.setValue({ email: 'alguien@ejemplo.com', password: 'claveErrada' });

    await component.onSubmit();

    expect(component.serverError()).toBe('Correo o contraseña incorrectos.');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.loading()).toBeFalse();
  });

  it('emite forgotPassword para que la página abra el diálogo', () => {
    const spy = jasmine.createSpy('forgotPassword');
    component.forgotPassword.subscribe(spy);

    component.forgotPassword.emit();

    expect(spy).toHaveBeenCalled();
  });
});
