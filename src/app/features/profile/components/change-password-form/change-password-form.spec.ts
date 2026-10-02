import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services/auth/auth-service';

import { ChangePasswordForm } from './change-password-form';

describe('ChangePasswordForm', () => {
  let component: ChangePasswordForm;
  let fixture: ComponentFixture<ChangePasswordForm>;
  let signIn: jasmine.Spy;
  let updatePassword: jasmine.Spy;
  let signOut: jasmine.Spy;

  // `null` y no `undefined` para el caso sin correo: pasarle `undefined` a un parámetro con valor
  // por defecto lo deja en el valor por defecto, así que el caso nunca se probaría.
  const setup = async (email: string | null = 'alguien@ejemplo.com') => {
    signIn = jasmine.createSpy('signIn').and.resolveTo(undefined);
    updatePassword = jasmine.createSpy('updatePassword').and.resolveTo(undefined);
    signOut = jasmine.createSpy('signOut').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [ChangePasswordForm],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn,
            updatePassword,
            signOut,
            getCurrentUser: () => (email ? { id: 'u1', email } : null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** Rellena el formulario con algo válido, salvo lo que se quiera cambiar. */
  const rellenar = (valores: Partial<ReturnType<ChangePasswordForm['form']['getRawValue']>>) => {
    component.form.setValue({
      currentPassword: 'la-de-antes',
      password: 'unaNuevaLarga',
      confirmPassword: 'unaNuevaLarga',
      ...valores,
    });
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('no envía nada si las contraseñas no coinciden', async () => {
    await setup();
    rellenar({ confirmPassword: 'otraDistinta' });

    await component.onSubmit();

    expect(signIn).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('no envía nada si la nueva es demasiado corta', async () => {
    await setup();
    rellenar({ password: 'corta', confirmPassword: 'corta' });

    await component.onSubmit();

    expect(updatePassword).not.toHaveBeenCalled();
  });

  /**
   * El núcleo de este componente: Supabase acepta el cambio con solo tener sesión válida
   * (`secure_password_change = false`), así que la contraseña actual se comprueba aquí iniciando
   * sesión con ella.
   */
  it('comprueba la contraseña actual antes de cambiar nada', async () => {
    await setup();
    rellenar({});

    await component.onSubmit();

    expect(signIn).toHaveBeenCalledWith('alguien@ejemplo.com', 'la-de-antes');
    expect(updatePassword).toHaveBeenCalledWith('unaNuevaLarga');
  });

  /** Si la actual no cuadra, no se llega a tocar la cuenta. Es el test que protege la decisión. */
  it('no cambia la contraseña si la actual es incorrecta', async () => {
    await setup();
    signIn.and.rejectWith({ code: 'invalid_credentials' });
    rellenar({});

    await component.onSubmit();

    expect(updatePassword).not.toHaveBeenCalled();
    expect(component.serverError()).toBe('Correo o contraseña incorrectos.');
    expect(component.changed()).toBeFalse();
  });

  it('limpia el formulario y confirma cuando el cambio sale bien', async () => {
    await setup();
    rellenar({});

    await component.onSubmit();

    expect(component.changed()).toBeTrue();
    expect(component.serverError()).toBeNull();
    expect(component.form.getRawValue().password).toBe('');
  });

  /**
   * A diferencia del flujo de recuperación, aquí el estudiante está en mitad de su trabajo: echarlo
   * sería un castigo por haber cuidado su cuenta.
   */
  it('no cierra la sesión al terminar', async () => {
    await setup();
    rellenar({});

    await component.onSubmit();

    expect(signOut).not.toHaveBeenCalled();
  });

  it('avisa en vez de intentarlo si la sesión ya no tiene correo', async () => {
    await setup(null);
    rellenar({});

    await component.onSubmit();

    expect(signIn).not.toHaveBeenCalled();
    expect(component.serverError()).toContain('sesión expiró');
  });
});
