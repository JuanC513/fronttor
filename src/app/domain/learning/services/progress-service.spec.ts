import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { ProgressService } from './progress-service';

describe('ProgressService', () => {
  let service: ProgressService;
  let rpc: jasmine.Spy;
  let from: jasmine.Spy;
  let select: jasmine.Spy;
  let eq: jasmine.Spy;

  /**
   * Se dobla `SupabaseService` y no el cliente entero: la superficie que tocan estos métodos es
   * exactamente `client.rpc`, y doblar más sería describir un contrato que no usan.
   */
  const setup = (
    result: { data?: unknown; error: { message: string } | null } = { data: null, error: null },
  ) => {
    rpc = jasmine.createSpy('rpc').and.resolveTo(result);
    eq = jasmine.createSpy('eq').and.resolveTo(result);
    select = jasmine.createSpy('select').and.returnValue({ eq });
    from = jasmine.createSpy('from').and.returnValue({ select });

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc, from } } }],
    });

    service = TestBed.inject(ProgressService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  describe('getForStudent', () => {
    /**
     * El filtro es el arreglo de un bug real: `lesson_progress` tiene dos policies de lectura, así
     * que una cuenta con rol de profesor recibía por la RLS el progreso de todos y la vista del
     * estudiante acababa pintando el avance de otra persona.
     */
    it('pide solo las filas del estudiante', async () => {
      setup({ data: [], error: null });

      await service.getForStudent('usuario-1');

      expect(from).toHaveBeenCalledWith('lesson_progress');
      expect(eq).toHaveBeenCalledWith('user_id', 'usuario-1');
    });

    it('devuelve una lista vacía cuando no hay filas', async () => {
      setup({ data: null, error: null });

      expect(await service.getForStudent('usuario-1')).toEqual([]);
    });

    it('propaga el error de la base', async () => {
      setup({ error: { message: 'permission denied' } });

      await expectAsync(service.getForStudent('usuario-1')).toBeRejectedWithError(
        /permission denied/,
      );
    });
  });

  describe('isLessonReachable', () => {
    /**
     * El nombre del parámetro es un contrato con Postgres: si no coincide con el de la función,
     * PostgREST responde que no encuentra ninguna candidata. No hay tipos que lo protejan.
     */
    it('pregunta por el subtema que se le pasa', async () => {
      setup({ data: true, error: null });

      await service.isLessonReachable(101);

      expect(rpc).toHaveBeenCalledWith('lesson_is_reachable', { p_lesson_id: 101 });
    });

    it('es alcanzable cuando la base dice que sí', async () => {
      setup({ data: true, error: null });

      expect(await service.isLessonReachable(101)).toBeTrue();
    });

    it('no es alcanzable cuando la base dice que no', async () => {
      setup({ data: false, error: null });

      expect(await service.isLessonReachable(101)).toBeFalse();
    });

    /** `null` es «no es parte del recorrido», y eso también es un no: no hay nada que abrir. */
    it('trata el null como no alcanzable', async () => {
      setup({ data: null, error: null });

      expect(await service.isLessonReachable(101)).toBeFalse();
    });

    /** Quien decide qué hacer con el fallo es el guard, no esto. */
    it('propaga el error de la base', async () => {
      setup({ error: { message: 'permission denied' } });

      await expectAsync(service.isLessonReachable(101)).toBeRejectedWithError(/permission denied/);
    });
  });

  describe('markLessonViewed', () => {
    it('avisa a los consumidores de que el progreso cambió', async () => {
      setup();
      const antes = service.refreshTrigger();

      await service.markLessonViewed(101);

      expect(rpc).toHaveBeenCalledWith('mark_lesson_viewed', { p_lesson_id: 101 });
      expect(service.refreshTrigger()).toBe(antes + 1);
    });

    /**
     * Desde `20260929120000` la RPC falla sobre un subtema al que el estudiante no ha llegado. El
     * error tiene que salir de aquí para que la página pueda decidir; y no se notifica un refresco,
     * porque no se escribió nada.
     */
    it('propaga el rechazo y no notifica refresco', async () => {
      setup({ error: { message: 'Este subtema todavia no esta disponible' } });
      const antes = service.refreshTrigger();

      await expectAsync(service.markLessonViewed(101)).toBeRejectedWithError(
        /todavia no esta disponible/,
      );
      expect(service.refreshTrigger()).toBe(antes);
    });
  });
});
