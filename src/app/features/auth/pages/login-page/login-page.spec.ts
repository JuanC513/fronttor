import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    // Sin este mock, el AuthService real crearía un cliente de Supabase y consultaría la sesión.
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'signIn',
      'signUp',
      'signInWithGoogle',
      'sendPasswordReset',
    ]);

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra las dos pestañas de la card', () => {
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('p-tab') as NodeListOf<HTMLElement>,
    );

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Iniciar sesión', 'Registrarse']);
  });

  it('arranca con el diálogo de recuperación cerrado', () => {
    expect(component.forgotDialogVisible()).toBeFalse();
  });

  it('delega en AuthService al continuar con Google', async () => {
    authService.signInWithGoogle.and.resolveTo();

    await component.onGoogleLogin();

    expect(authService.signInWithGoogle).toHaveBeenCalled();
    expect(component.googleError()).toBeNull();
  });

  it('traduce el error y apaga el spinner si Google falla', async () => {
    // El caso típico mientras el proveedor no está habilitado en el dashboard de Supabase.
    authService.signInWithGoogle.and.rejectWith({ code: 'provider_disabled' });

    await component.onGoogleLogin();

    expect(component.googleError()).toBe('Este método de inicio de sesión no está habilitado.');
    expect(component.googleLoading()).toBeFalse();
  });
});
