import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services/auth/auth-service';
import { ForgotPasswordDialog } from './forgot-password-dialog';

describe('ForgotPasswordDialog', () => {
  let component: ForgotPasswordDialog;
  let fixture: ComponentFixture<ForgotPasswordDialog>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['sendPasswordReset']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordDialog],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no envía nada si el correo es inválido', async () => {
    component.forgotForm.setValue({ email: 'no-es-un-correo' });

    await component.onSubmit();

    expect(authService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('confirma el envío sin revelar si la cuenta existe', async () => {
    authService.sendPasswordReset.and.resolveTo();
    component.forgotForm.setValue({ email: 'alguien@ejemplo.com' });

    await component.onSubmit();

    expect(authService.sendPasswordReset).toHaveBeenCalledWith('alguien@ejemplo.com');
    expect(component.emailSent()).toBeTrue();
  });

  it('limpia su estado al cerrarse para no reabrir con el mensaje anterior', () => {
    component.emailSent.set(true);
    component.serverError.set('algo salió mal');

    component.onHide();

    expect(component.emailSent()).toBeFalse();
    expect(component.serverError()).toBeNull();
  });
});
