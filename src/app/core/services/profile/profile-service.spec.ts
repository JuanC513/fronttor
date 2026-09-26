import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { ProfileService } from './profile-service';

describe('ProfileService', () => {
  let service: ProfileService;
  let update: jasmine.Spy;
  let eq: jasmine.Spy;
  let from: jasmine.Spy;

  const setup = (error: { message: string } | null = null) => {
    eq = jasmine.createSpy('eq').and.resolveTo({ error });
    update = jasmine.createSpy('update').and.returnValue({ eq });
    from = jasmine.createSpy('from').and.returnValue({ update });

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { from } } }],
    });

    service = TestBed.inject(ProfileService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  /**
   * El grant de `20260919120000` concede `update` sobre **una sola columna**. Tocar cualquier otra
   * no fallaría en el test pero sí en la base, y con un mensaje que no dice lo que pasa.
   */
  it('escribe solo la descripción, y solo la fila del usuario', async () => {
    setup();

    await service.saveDescription('u1', 'Vengo de backend');

    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ profile_description: 'Vengo de backend' });
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('recorta los espacios', async () => {
    setup();

    await service.saveDescription('u1', '  Hola  ');

    expect(update).toHaveBeenCalledWith({ profile_description: 'Hola' });
  });

  /** Vaciar el campo es borrar el perfil, no guardar una cadena vacía que luego hay que interpretar. */
  it('guarda null cuando se deja en blanco', async () => {
    setup();

    await service.saveDescription('u1', '   ');

    expect(update).toHaveBeenCalledWith({ profile_description: null });
  });

  it('propaga el error de la base', async () => {
    setup({ message: 'permission denied' });

    await expectAsync(service.saveDescription('u1', 'algo')).toBeRejectedWithError(
      /permission denied/,
    );
  });
});
