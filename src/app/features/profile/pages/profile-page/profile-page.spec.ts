import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { ProfileService } from '@core/services/profile/profile-service';
import { Profile } from '@core/interfaces/profile';
import { BehaviorSubject } from 'rxjs';

import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;
  let saveDescription: jasmine.Spy;
  let refreshProfile: jasmine.Spy;
  let profile$: BehaviorSubject<Profile | null>;

  const profile = (description: string | null): Profile => ({
    user_id: 'u1',
    email: 'alguien@ejemplo.com',
    profile_description: description,
    roles: ['student'],
  });

  const setup = async (description: string | null = null) => {
    profile$ = new BehaviorSubject<Profile | null>(profile(description));
    saveDescription = jasmine.createSpy('saveDescription').and.resolveTo(undefined);
    refreshProfile = jasmine.createSpy('refreshProfile').and.callFake(async () => {
      profile$.next(profile(component.description().trim() || null));
    });

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: { saveDescription } },
        {
          provide: AuthService,
          useValue: {
            profile$,
            refreshProfile,
            getCurrentUser: () => ({ id: 'u1' }),
            signOut: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
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
    expect(component.saved()).toBeTrue();
    expect(component.error()).toBeNull();
  });

  it('avisa si no se pudo guardar y no dice que guardó', async () => {
    await setup('Viejo');
    saveDescription.and.rejectWith(new Error('permission denied'));
    component.onDescriptionChange('Nuevo');

    await component.save();

    expect(component.error()).toContain('permission denied');
    expect(component.saved()).toBeFalse();
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
});
