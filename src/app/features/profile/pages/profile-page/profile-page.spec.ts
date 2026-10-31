import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { ProfileService } from '@core/services/profile/profile-service';
import { Profile } from '@core/interfaces/profile';
import { NotificationService } from '@core/services/notification/notification-service';
import { ConfirmationService } from 'primeng/api';
import { BehaviorSubject } from 'rxjs';

import { ProfilePage } from './profile-page';

/** Lo que la vista mira del usuario de Supabase: de dónde salió la cuenta. */
interface UsuarioFalso {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
}

interface Opciones {
  createdAt?: string;
  appMetadata?: Record<string, unknown>;
}

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;
  let saveDescription: jasmine.Spy;
  let refreshProfile: jasmine.Spy;
  let profile$: BehaviorSubject<Profile | null>;
  let signOut: jasmine.Spy;
  let exito: jasmine.Spy;
  let error: jasmine.Spy;
  let createdAt: string | undefined;

  const profile = (description: string | null): Profile => ({
    user_id: 'u1',
    email: 'alguien@ejemplo.com',
    created_at: createdAt,
    profile_description: description,
    roles: ['student'],
  });

  const setup = async (description: string | null = null, opciones: Opciones = {}) => {
    createdAt = opciones.createdAt;

    const user$ = new BehaviorSubject<UsuarioFalso | null>({
      id: 'u1',
      email: 'alguien@ejemplo.com',
      app_metadata: opciones.appMetadata ?? { provider: 'email', providers: ['email'] },
    });

    profile$ = new BehaviorSubject<Profile | null>(profile(description));
    signOut = jasmine.createSpy('signOut').and.resolveTo(undefined);
    exito = jasmine.createSpy('exito');
    error = jasmine.createSpy('error');
    saveDescription = jasmine.createSpy('saveDescription').and.resolveTo(undefined);
    refreshProfile = jasmine.createSpy('refreshProfile').and.callFake(async () => {
      profile$.next(profile(component.description().trim() || null));
    });

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: { saveDescription } },
        // El aviso ya no vive en una señal del componente: se emite y se olvida.
        { provide: NotificationService, useValue: { exito, error } },
        {
          provide: AuthService,
          useValue: {
            profile$,
            user$,
            refreshProfile,
            getCurrentUser: () => ({ id: 'u1', email: 'alguien@ejemplo.com' }),
            signIn: () => Promise.resolve(),
            updatePassword: () => Promise.resolve(),
            signOut,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** `onLogout` pide confirmación; la prueba acepta por el estudiante. */
  const acceptConfirmation = () => {
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((options) => {
      options.accept?.();
      return confirmation;
    });
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('parte de lo que ya estaba guardado', async () => {
    await setup('Vengo de backend');

    expect(component.description()).toBe('Vengo de backend');
  });

  /** Sin cambios no hay nada que guardar: el botón no invita a gastar una escritura. */
  it('solo deja guardar cuando el texto cambió', async () => {
    await setup('Vengo de backend');
    expect(component.canSave()).toBeFalse();

    component.onDescriptionChange('Vengo de backend y quiero un portafolio');

    expect(component.canSave()).toBeTrue();
  });

  /**
   * Sin el refresco, `profile$` se quedaría con el texto anterior y la vista mostraría lo viejo
   * justo después de haber escrito lo nuevo.
   */
  it('guarda y pide el refresco del perfil', async () => {
    await setup('Viejo');
    component.onDescriptionChange('Nuevo');

    await component.save();

    expect(saveDescription).toHaveBeenCalledWith('u1', 'Nuevo');
    expect(refreshProfile).toHaveBeenCalled();
    expect(exito).toHaveBeenCalledWith('Guardado. Tu tutor ya lo tiene en cuenta');
    expect(error).not.toHaveBeenCalled();
  });

  it('avisa si no se pudo guardar y no dice que guardó', async () => {
    await setup('Viejo');
    saveDescription.and.rejectWith(new Error('permission denied'));
    component.onDescriptionChange('Nuevo');

    await component.save();

    expect(error).toHaveBeenCalledWith('No se pudo guardar', 'permission denied');
    expect(exito).not.toHaveBeenCalled();
    expect(component.justSaved()).toBeFalse();
  });

  /** El toast se va en tres segundos; la marca junto al botón se queda mientras siga siendo cierta. */
  it('deja «Guardado» junto al botón hasta que se vuelve a escribir', async () => {
    await setup('Viejo');
    component.onDescriptionChange('Nuevo');

    await component.save();
    fixture.detectChanges();

    const aviso = () => (fixture.nativeElement as HTMLElement).querySelector('.saved-notice');
    expect(aviso()?.textContent).toContain('Guardado');

    component.onDescriptionChange('Nuevo, corregido');
    fixture.detectChanges();

    expect(aviso()).toBeNull();
  });

  /** Borrarlo todo es una decisión, no un campo sin rellenar: no puede volver solo el texto viejo. */
  it('deja vaciar la descripción', async () => {
    await setup('Vengo de backend');

    component.onDescriptionChange('');
    fixture.detectChanges();

    expect(component.description()).toBe('');
    expect(component.canSave()).toBeTrue();

    await component.save();

    expect(saveDescription).toHaveBeenCalledWith('u1', '');
  });

  /** El perfil puede recargarse por detrás; lo que el estudiante esté escribiendo no se toca. */
  it('no pisa lo que se está escribiendo si el perfil se recarga', async () => {
    await setup(null);
    component.onDescriptionChange('a medio escribir');

    profile$.next(profile('algo que llegó de la base'));
    fixture.detectChanges();

    expect(component.description()).toBe('a medio escribir');
  });

  describe('miembro desde', () => {
    it('lo muestra en español a partir de created_at', async () => {
      await setup(null, { createdAt: '2026-09-15T10:00:00Z' });

      expect(component.memberSince()).toBe('septiembre de 2026');
      expect(fixture.nativeElement.querySelector('.profile-since').textContent).toContain(
        'septiembre de 2026',
      );
    });

    /**
     * La columna es `not null` en la base, pero la interfaz la declara opcional y un perfil a medio
     * cargar no puede acabar enseñando «Invalid Date».
     */
    it('no pinta la línea si el perfil no trae la fecha', async () => {
      await setup(null);

      expect(component.memberSince()).toBe('');
      expect(fixture.nativeElement.querySelector('.profile-since')).toBeNull();
    });
  });

  describe('cerrar sesión', () => {
    /**
     * El botón vive arriba a la derecha de la cabecera, donde la mano va a parar sola. Sin la
     * pregunta, un roce echa de la aplicación a quien solo pasaba por ahí.
     */
    it('pregunta antes de cerrar la sesión', async () => {
      await setup();

      component.onLogout();

      expect(signOut).not.toHaveBeenCalled();
    });

    it('cierra la sesión y vuelve al login cuando se acepta', async () => {
      await setup();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      acceptConfirmation();

      component.onLogout();
      await fixture.whenStable();

      expect(signOut).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/login']);
      expect(error).not.toHaveBeenCalled();
      // Sin aviso de éxito: `/login` queda fuera del layout donde vive el toast.
      expect(exito).not.toHaveBeenCalled();
    });

    /**
     * Sin esto, un `signOut` que falla cerraba la confirmación y no hacía nada más: parecía que
     * había funcionado con la sesión todavía abierta, que es la peor forma de fallar que hay.
     */
    it('avisa y no navega si no se pudo cerrar la sesión', async () => {
      await setup();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      signOut.and.rejectWith({ code: 'over_request_rate_limit' });
      acceptConfirmation();

      component.onLogout();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(navigate).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        'No se pudo cerrar la sesión',
        'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      );
    });

    it('deja reintentar después de un fallo', async () => {
      await setup();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      signOut.and.rejectWith({ code: 'over_request_rate_limit' });
      acceptConfirmation();

      component.onLogout();
      await fixture.whenStable();
      expect(error).toHaveBeenCalledTimes(1);

      signOut.and.resolveTo(undefined);
      component.onLogout();
      await fixture.whenStable();

      expect(error).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('bloque de seguridad', () => {
    it('ofrece cambiar la contraseña en una cuenta de correo', async () => {
      await setup();

      expect(component.tienePassword()).toBeTrue();
      expect(fixture.nativeElement.querySelector('app-change-password-form')).not.toBeNull();
    });

    /** Un formulario que no puede funcionar es peor que no tenerlo. */
    it('no ofrece el formulario en una cuenta de Google', async () => {
      await setup(null, { appMetadata: { provider: 'google', providers: ['google'] } });

      expect(component.tienePassword()).toBeFalse();
      expect(fixture.nativeElement.querySelector('app-change-password-form')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('la gestiona Google');
    });

    /**
     * `provider` es solo el del último inicio de sesión. Quien se registró con correo y alguna vez
     * entró con Google sigue teniendo contraseña, y seguiría necesitando cambiarla.
     */
    it('la ofrece si el correo está entre los proveedores aunque el último fuera Google', async () => {
      await setup(null, { appMetadata: { provider: 'google', providers: ['email', 'google'] } });

      expect(component.tienePassword()).toBeTrue();
    });
  });
});
