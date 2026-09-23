import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { AttemptService, AttemptSubmission } from './attempt-service';

describe('AttemptService', () => {
  let service: AttemptService;
  let rpc: jasmine.Spy;

  const submission: AttemptSubmission = {
    exerciseId: 7,
    code: { html: '<h1>Hola</h1>', css: 'h1 { color: red }', js: 'console.log(1)' },
    passed: true,
    results: [{ description: 'Existe un h1', passed: true }],
  };

  /**
   * Se dobla `SupabaseService` y no el cliente entero: la superficie que toca este servicio es
   * exactamente `client.rpc`, y doblar más sería describir un contrato que no usa.
   */
  const setup = (
    result: { data?: unknown; error: { message: string } | null } = { data: 42, error: null },
  ) => {
    rpc = jasmine.createSpy('rpc').and.resolveTo(result);

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    service = TestBed.inject(AttemptService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  /**
   * Los nombres de los parámetros son un contrato con Postgres: si no coinciden con los de la
   * función, PostgREST responde que no encuentra ninguna candidata. No hay tipos que lo protejan.
   */
  it('traduce el envío a los parámetros que espera la RPC', async () => {
    setup();

    await service.submitAttempt(submission);

    expect(rpc).toHaveBeenCalledWith('submit_exercise_attempt', {
      p_exercise_id: 7,
      p_html: '<h1>Hola</h1>',
      p_css: 'h1 { color: red }',
      p_js: 'console.log(1)',
      p_passed: true,
      p_results: [{ description: 'Existe un h1', passed: true }],
    });
  });

  it('registra también los intentos fallidos', async () => {
    setup();

    await service.submitAttempt({ ...submission, passed: false });

    expect(rpc.calls.mostRecent().args[1].p_passed).toBeFalse();
  });

  it('avisa a los consumidores tras registrar', async () => {
    setup();
    const before = service.refreshTrigger();

    await service.submitAttempt(submission);

    expect(service.refreshTrigger()).toBeGreaterThan(before);
  });

  /** El id es lo que después permite archivar la pista en el intento correcto. */
  it('devuelve el id con el que quedó registrado el intento', async () => {
    setup({ data: 77, error: null });

    expect(await service.submitAttempt(submission)).toBe(77);
  });

  it('relanza el error de Supabase con su mensaje', async () => {
    setup({ error: { message: 'El ejercicio no existe' } });

    await expectAsync(service.submitAttempt(submission)).toBeRejectedWithError(
      'El ejercicio no existe',
    );
  });

  /** Si la escritura falló, nadie debe recargar creyendo que hay algo nuevo. */
  it('no avisa cuando la escritura falla', async () => {
    setup({ error: { message: 'No autenticado' } });
    const before = service.refreshTrigger();

    await expectAsync(service.submitAttempt(submission)).toBeRejected();

    expect(service.refreshTrigger()).toBe(before);
  });

  /* ─── La retroalimentación ─── */

  describe('setFeedback', () => {
    it('apunta al intento, no al ejercicio', async () => {
      setup();

      await service.setFeedback(77, 'Te falta el nav.');

      expect(rpc).toHaveBeenCalledWith('set_attempt_feedback', {
        p_attempt_id: 77,
        p_feedback: 'Te falta el nav.',
      });
    });

    it('relanza el error de Supabase con su mensaje', async () => {
      setup({ error: { message: 'No autenticado' } });

      await expectAsync(service.setFeedback(77, 'Te falta el nav.')).toBeRejectedWithError(
        'No autenticado',
      );
    });
  });

  /* ─── El último envío ─── */

  describe('getLastAttempt', () => {
    let calls: { method: string; args: unknown[] }[];

    /**
     * El constructor de consultas de supabase-js encadena, así que el doble devuelve `this` en
     * cada eslabón y registra la llamada. Así se puede comprobar la consulta que se arma —que es
     * lo único que este método decide— sin montar un cliente de verdad.
     */
    const setupQuery = (result: { data: unknown; error: { message: string } | null }) => {
      calls = [];

      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'limit']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      builder['maybeSingle'] = () => Promise.resolve(result);

      const from = jasmine.createSpy('from').and.returnValue(builder);

      TestBed.configureTestingModule({
        providers: [{ provide: SupabaseService, useValue: { client: { from } } }],
      });

      service = TestBed.inject(AttemptService);
      return from;
    };

    const row = {
      submitted_html: '<h1>Hola</h1>',
      submitted_css: 'h1 { color: red }',
      submitted_js: '',
      passed: false,
      created_at: '2026-09-22T10:00:00Z',
      feedback: 'Te falta el nav.',
    };

    it('devuelve el código del último envío', async () => {
      setupQuery({ data: row, error: null });

      const draft = await service.getLastAttempt(7, 'usuario-1');

      expect(draft).toEqual({
        code: { html: '<h1>Hola</h1>', css: 'h1 { color: red }', js: '' },
        passed: false,
        createdAt: '2026-09-22T10:00:00Z',
        feedback: 'Te falta el nav.',
      });
    });

    it('devuelve null cuando nunca se envió nada', async () => {
      setupQuery({ data: null, error: null });

      expect(await service.getLastAttempt(7, 'usuario-1')).toBeNull();
    });

    /**
     * El filtro por usuario es lo que impide que a una cuenta con rol de profesor —que por RLS ve
     * los intentos de todos— se le cargue en el editor el código de otro estudiante. Y como la
     * consulta pide el más reciente, sin él sería precisamente el último de cualquiera.
     */
    it('acota la búsqueda al usuario y al ejercicio', async () => {
      setupQuery({ data: row, error: null });

      await service.getLastAttempt(7, 'usuario-1');

      const filters = calls.filter((call) => call.method === 'eq').map((call) => call.args);
      expect(filters).toContain(['exercise_id', 7]);
      expect(filters).toContain(['user_id', 'usuario-1']);
    });

    it('pide solo el más reciente', async () => {
      setupQuery({ data: row, error: null });

      await service.getLastAttempt(7, 'usuario-1');

      expect(calls.find((call) => call.method === 'order')?.args).toEqual([
        'created_at',
        { ascending: false },
      ]);
      expect(calls.find((call) => call.method === 'limit')?.args).toEqual([1]);
    });

    /** La solución de referencia no está aquí, pero el código de otros sí: se piden las columnas. */
    it('no pide columnas de más', async () => {
      setupQuery({ data: row, error: null });

      await service.getLastAttempt(7, 'usuario-1');

      expect(calls.find((call) => call.method === 'select')?.args[0]).toBe(
        'submitted_html, submitted_css, submitted_js, passed, created_at, feedback',
      );
    });

    it('relanza el error de Supabase con su mensaje', async () => {
      setupQuery({ data: null, error: { message: 'permission denied' } });

      await expectAsync(service.getLastAttempt(7, 'usuario-1')).toBeRejectedWithError(
        'permission denied',
      );
    });
  });
});
