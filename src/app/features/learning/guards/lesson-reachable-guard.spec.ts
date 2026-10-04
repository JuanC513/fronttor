import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { ProgressService } from '@domain/learning/services/progress-service';

import { lessonReachableGuard } from './lesson-reachable-guard';

describe('lessonReachableGuard', () => {
  let isLessonReachable: jasmine.Spy;
  let router: jasmine.SpyObj<Router>;
  const urlTree = {} as UrlTree;

  /** El guard solo lee `lessonId` del snapshot, así que basta con un `paramMap` de mentira. */
  const snapshot = (lessonId: string | null) =>
    ({ paramMap: { get: () => lessonId } }) as unknown as ActivatedRouteSnapshot;

  const run = (lessonId: string | null) =>
    TestBed.runInInjectionContext(() =>
      lessonReachableGuard(snapshot(lessonId), {} as never),
    ) as Promise<boolean | UrlTree>;

  const setup = () => {
    isLessonReachable = jasmine.createSpy('isLessonReachable').and.resolveTo(true);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(urlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: ProgressService, useValue: { isLessonReachable } },
        { provide: Router, useValue: router },
      ],
    });
  };

  beforeEach(setup);
  afterEach(() => TestBed.resetTestingModule());

  it('deja pasar al subtema alcanzable', async () => {
    expect(await run('101')).toBeTrue();
    expect(isLessonReachable).toHaveBeenCalledWith(101);
  });

  it('devuelve a la lista cuando todavía no se ha llegado', async () => {
    isLessonReachable.and.resolveTo(false);

    expect(await run('101')).toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/learning/modules']);
  });

  it('devuelve a la lista si el id no es un número', async () => {
    expect(await run('abc')).toBe(urlTree);
    expect(isLessonReachable).not.toHaveBeenCalled();
  });

  it('devuelve a la lista si falta el id', async () => {
    expect(await run(null)).toBe(urlTree);
    expect(isLessonReachable).not.toHaveBeenCalled();
  });

  /**
   * El caso que el `catch` no cubre: una promesa colgada no lanza. Sin tope, la navegación se queda
   * esperando para siempre y el estudiante ve un botón que no hace nada. Se reprodujo de verdad con
   * el cliente de Supabase sin poder tomar el `navigator.lock` de su sesión.
   */
  it('deja pasar si la consulta no responde nunca', async () => {
    jasmine.clock().install();
    isLessonReachable.and.returnValue(new Promise(() => undefined));

    const resultado = run('101');
    jasmine.clock().tick(3_001);
    jasmine.clock().uninstall();

    expect(await resultado).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  /** Y lo contrario: si responde a tiempo, manda la respuesta, no el tope. */
  it('respeta la respuesta cuando llega antes del tope', async () => {
    jasmine.clock().install();
    isLessonReachable.and.resolveTo(false);

    const resultado = run('101');
    jasmine.clock().tick(3_001);
    jasmine.clock().uninstall();

    expect(await resultado).toBe(urlTree);
  });

  /**
   * La barrera de verdad está en la base, así que este guard es comodidad: dejar a alguien sin poder
   * leer por un fallo de red sería peor que el problema que resuelve.
   */
  it('deja pasar cuando la consulta falla', async () => {
    isLessonReachable.and.rejectWith(new Error('sin conexión'));

    expect(await run('101')).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
