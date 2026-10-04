import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { TutorActivityService } from './tutor-activity-service';

describe('TutorActivityService', () => {
  let service: TutorActivityService;
  let rpc: jasmine.Spy;

  const setup = (
    result: { data?: unknown; error: { message: string } | null } = { data: null, error: null },
  ) => {
    rpc = jasmine.createSpy('rpc').and.resolveTo(result);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    service = TestBed.inject(TutorActivityService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  /**
   * El nombre es un contrato con Postgres que ningún tipo protege: si no coincide, PostgREST
   * responde que no encuentra la función. Y no lleva usuario a propósito —la RPC lo resuelve con
   * `auth.uid()`—, que es lo que impide pedir la actividad de otra persona.
   */
  it('llama a la RPC sin pasarle ningún usuario', async () => {
    setup({ data: { preguntas: 1, pistas: 0, practicas: 0, ultima: null }, error: null });

    await service.getMyActivity();

    expect(rpc).toHaveBeenCalledWith('get_my_tutor_activity');
  });

  it('devuelve lo que trae la base', async () => {
    const ultima = {
      tipo: 'question' as const,
      cuando: '2026-09-01T10:00:00Z',
      subtema: 'Etiquetas',
    };
    setup({ data: { preguntas: 12, pistas: 5, practicas: 3, ultima }, error: null });

    expect(await service.getMyActivity()).toEqual({
      preguntas: 12,
      pistas: 5,
      practicas: 3,
      ultima,
    });
  });

  /** Un estudiante que no ha usado el tutor da ceros, no `undefined` en la plantilla. */
  it('rellena con ceros lo que la base no devuelva', async () => {
    setup({ data: { preguntas: 4 }, error: null });

    expect(await service.getMyActivity()).toEqual({
      preguntas: 4,
      pistas: 0,
      practicas: 0,
      ultima: null,
    });
  });

  it('propaga el error de la base', async () => {
    setup({ error: { message: 'permission denied' } });

    await expectAsync(service.getMyActivity()).toBeRejectedWithError(/permission denied/);
  });
});
