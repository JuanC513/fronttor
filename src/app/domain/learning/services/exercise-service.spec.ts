import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { ExerciseService } from './exercise-service';

/**
 * Lo que este spec vigila es una sola cosa: que **ninguna lectura pida la solución de referencia**.
 *
 * Desde 20260926120000_hide_exercise_solution.sql, `authenticated` no tiene SELECT sobre
 * `solution_*`, así que un `select('*')` no devuelve la solución: revienta la consulta entera con
 * «permission denied for column». El error se vería en el navegador, pero se vería tarde y lejos
 * del cambio que lo provocó. Aquí se ve al instante.
 */
describe('ExerciseService', () => {
  let service: ExerciseService;
  let rpc: jasmine.Spy;
  let from: jasmine.Spy;
  /** Cada cadena de columnas que se le pasó a `select()`, en orden. */
  let selects: string[];

  /**
   * Cadena encadenable que además se puede esperar.
   *
   * `select().eq().order()` se resuelve tal cual, y `.single()` devuelve su propia promesa, que es
   * exactamente la superficie que usa el servicio.
   */
  const buildChain = (result: { data: unknown; error: { message: string } | null }) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      single: () => Promise.resolve(result),
    };

    chain['select'] = jasmine.createSpy('select').and.callFake((columns: string) => {
      selects.push(columns);
      return chain;
    });
    chain['eq'] = jasmine.createSpy('eq').and.callFake(() => chain);
    chain['order'] = jasmine.createSpy('order').and.callFake(() => chain);

    return chain;
  };

  const setup = (data: unknown = []) => {
    selects = [];
    const result = { data, error: null };

    from = jasmine.createSpy('from').and.callFake(() => buildChain(result));
    rpc = jasmine.createSpy('rpc').and.callFake(() => buildChain(result));

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { from, rpc } } }],
    });

    service = TestBed.inject(ExerciseService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  describe('la solución de referencia no sale por la tabla', () => {
    it('ninguna lectura la pide, ni con un comodín', async () => {
      setup([]);

      await service.getAllWithLesson();
      await service.getAllByLessonId(1);
      await service.getPublishedForStudent('u1');
      await service.getForStudent(7, 'u1');

      expect(selects.length).toBe(4);

      for (const columns of selects) {
        expect(columns).not.toContain('solution');
        // El comodín tampoco vale: con el grant por columnas se expande a lo que el rol no tiene.
        expect(columns).not.toContain('*');
      }
    });

    /** El formulario del profesor es el único que la necesita, y la pide por la puerta buena. */
    it('el formulario la recibe por la RPC, no por la tabla', async () => {
      setup({ id: 7, name: 'Ejercicio', solution_html: '<h1>Hola</h1>' });

      const exercise = await service.getById(7);

      expect(rpc).toHaveBeenCalledWith('get_exercise_for_edit', { p_id: 7 });
      expect(from).not.toHaveBeenCalled();
      expect(exercise.solution_html).toBe('<h1>Hola</h1>');
    });
  });

  describe('las lecturas del estudiante', () => {
    /**
     * El filtro por `user_id` no sobra: `exercise_attempts` tiene dos policies de lectura, y una
     * cuenta con los dos roles vería por el embed los intentos de todo el mundo.
     */
    it('acotan el ejercicio a lo publicado y los intentos a los suyos', async () => {
      setup({ id: 7, exercise_attempts: [{ passed: true }] });

      const exercise = await service.getForStudent(7, 'u1');
      const chain = from.calls.mostRecent().returnValue as Record<string, jasmine.Spy>;

      expect(chain['eq']).toHaveBeenCalledWith('is_published', true);
      expect(chain['eq']).toHaveBeenCalledWith('exercise_attempts.user_id', 'u1');
      expect(exercise.passed).toBeTrue();
    });

    it('marcan como aprobado solo si hay algún intento aprobado', async () => {
      setup({ id: 7, exercise_attempts: [] });

      expect((await service.getForStudent(7, 'u1')).passed).toBeFalse();
    });

    it('el listado acota igual', async () => {
      setup([{ id: 7, exercise_attempts: [{ passed: true }] }]);

      const [exercise] = await service.getPublishedForStudent('u1');
      const chain = from.calls.mostRecent().returnValue as Record<string, jasmine.Spy>;

      expect(chain['eq']).toHaveBeenCalledWith('is_published', true);
      expect(chain['eq']).toHaveBeenCalledWith('exercise_attempts.user_id', 'u1');
      expect(exercise.passed).toBeTrue();
    });
  });

  /** Solo se revocó SELECT: escribir la solución sigue pasando por las RPC de siempre. */
  describe('las escrituras', () => {
    it('siguen yendo por RPC', async () => {
      setup({ data: null });

      await service.delete(7);
      expect(rpc).toHaveBeenCalledWith('delete_exercise', { p_id: 7 });

      await service.reorderAll([3, 1, 2]);
      expect(rpc).toHaveBeenCalledWith('reorder_exercises', { p_ids: [3, 1, 2] });
    });

    it('notifican a los consumidores tras mutar', async () => {
      setup({ data: null });
      const before = service.refreshTrigger();

      await service.delete(7);

      expect(service.refreshTrigger()).toBeGreaterThan(before);
    });
  });
});
