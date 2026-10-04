import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';

import { LearningModules } from './learning-modules';

describe('LearningModules', () => {
  let router: jasmine.SpyObj<Router>;

  /**
   * Tema con `count` subtemas, cada uno con `blocksPerLesson` bloques; los ids se generan de
   * corrido para no repetirlos entre temas. `blocksPerLesson: 0` simula un subtema sin contenido.
   */
  const buildModule = (id: number, count: number, blocksPerLesson = 1): ModuleWithLessonCounts => ({
    id,
    name: `Tema ${id}`,
    order: id,
    is_published: true,
    lessons: Array.from({ length: count }, (_, index) => ({
      id: id * 100 + index,
      name: `Subtema ${index}`,
      order: index,
      module_id: id,
      is_published: true,
      blocks: [{ count: blocksPerLesson }],
    })),
  });

  const progressRow = (
    lessonId: number,
    status: 'in_progress' | 'completed' = 'completed',
  ): LessonProgress => ({
    id: lessonId,
    user_id: 'usuario-1',
    lesson_id: lessonId,
    status,
    exercises_at_completion: status === 'completed' ? 1 : null,
    completed_at: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
    updated_at: '2026-01-01T00:00:00Z',
  });

  const setup = async (modules: ModuleWithLessonCounts[], progress: LessonProgress[] = []) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.resolveTo(modules);

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getForStudent',
    ]);
    progressService.getForStudent.and.resolveTo(progress);

    // El progreso se pide por usuario, así que la vista necesita saber quién está en sesión.
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue({ id: 'usuario-1' } as never);

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [LearningModules],
      providers: [
        { provide: ModuleService, useValue: moduleService },
        { provide: ProgressService, useValue: progressService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });

    const fixture: ComponentFixture<LearningModules> = TestBed.createComponent(LearningModules);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    expect((await setup([])).componentInstance).toBeTruthy();
  });

  /**
   * El arranque real de cualquier estudiante: sin una sola fila de progreso, lo único abierto es
   * el primer subtema del curso.
   */
  it('sin progreso solo el primer subtema está disponible', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 2)])).componentInstance;
    const [first, second] = component.moduleViews();

    expect(first.lessons.map((item) => item.status)).toEqual(['available', 'locked']);
    expect(second.lessons.map((item) => item.status)).toEqual(['locked', 'locked']);
  });

  it('el desbloqueo encadena entre temas, no solo dentro de uno', async () => {
    // Completado el último subtema del tema 1, se abre el primero del tema 2.
    const component = (
      await setup([buildModule(1, 2), buildModule(2, 2)], [progressRow(100), progressRow(101)])
    ).componentInstance;
    const [first, second] = component.moduleViews();

    expect(first.lessons.map((item) => item.status)).toEqual(['completed', 'completed']);
    expect(second.lessons.map((item) => item.status)).toEqual(['available', 'locked']);
  });

  /**
   * El modo mixto DENTRO de un tema: haber ABIERTO un subtema basta para leer el siguiente, aunque
   * no esté completado. Lo que exige completarlo son sus ejercicios, y eso vive en la otra vista.
   */
  it('abrir un subtema sin completarlo ya desbloquea el contenido del siguiente', async () => {
    const component = (await setup([buildModule(1, 3)], [progressRow(100, 'in_progress')]))
      .componentInstance;

    expect(component.moduleViews()[0].lessons.map((item) => item.status)).toEqual([
      'in-progress',
      'available',
      'locked',
    ]);
  });

  it('marca como bloqueado el tema cuyos subtemas lo están todos', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 2)])).componentInstance;

    expect(component.moduleViews()[0].locked).toBeFalse();
    expect(component.moduleViews()[1].locked).toBeTrue();
  });

  /**
   * El bug que reportó el estudiante: entrar al último subtema del tema 1 —sin resolver su
   * ejercicio— desbloqueaba el tema 2, porque el candado del tema solo mira si alguno de sus
   * subtemas está abierto y la cadena no distinguía fronteras de tema.
   */
  it('el tema siguiente sigue bloqueado si el anterior no está completo', async () => {
    const component = (
      await setup(
        [buildModule(1, 2), buildModule(2, 2)],
        [progressRow(100), progressRow(101, 'in_progress')],
      )
    ).componentInstance;

    expect(component.moduleViews()[1].locked).toBeTrue();
  });

  it('el tema siguiente se abre al completar el anterior entero', async () => {
    const component = (
      await setup([buildModule(1, 2), buildModule(2, 2)], [progressRow(100), progressRow(101)])
    ).componentInstance;

    expect(component.moduleViews()[1].locked).toBeFalse();
  });

  /** «Disponible» y «En progreso» no son lo mismo: uno se abrió y el otro solo se puede abrir. */
  it('distingue el subtema abierto del que solo está disponible', async () => {
    const component = (await setup([buildModule(1, 2)], [progressRow(100, 'in_progress')]))
      .componentInstance;

    expect(component.moduleViews()[0].lessons.map((item) => item.status)).toEqual([
      'in-progress',
      'available',
    ]);
    expect(component.statusLabel('available')).toBe('Disponible');
  });

  it('calcula el progreso sobre el total de subtemas del curso', async () => {
    const component = (await setup([buildModule(1, 4)], [progressRow(100), progressRow(101)]))
      .componentInstance;

    expect(component.progress()).toBe(50);
  });

  it('abre el tema donde quedó el estudiante', async () => {
    const component = (
      await setup([buildModule(1, 2), buildModule(2, 2)], [progressRow(100), progressRow(101)])
    ).componentInstance;

    expect(component.activePanel()).toBe(2);
  });

  it('no navega al hacer clic en un subtema bloqueado', async () => {
    const component = (await setup([buildModule(1, 3)])).componentInstance;
    const locked = component.moduleViews()[0].lessons[2];

    component.onLessonClick(1, locked);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navega al detalle del subtema desbloqueado', async () => {
    const component = (await setup([buildModule(1, 3)], [progressRow(100)])).componentInstance;
    const available = component.moduleViews()[0].lessons[1];

    component.onLessonClick(1, available);

    expect(router.navigate).toHaveBeenCalledWith(['learning/modules/1/lessons/101']);
  });

  it('continúa en el primer subtema disponible sin completar', async () => {
    const component = (
      await setup([buildModule(1, 2), buildModule(2, 2)], [progressRow(100), progressRow(101)])
    ).componentInstance;

    component.onResumeLearning();

    expect(component.canResume()).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['learning/modules/2/lessons/200']);
  });

  it('deshabilita "continuar" cuando ya está todo completado', async () => {
    const component = (await setup([buildModule(1, 2)], [progressRow(100), progressRow(101)]))
      .componentInstance;

    expect(component.canResume()).toBeFalse();
  });

  it('oculta el tema que todavía no tiene subtemas', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 0)])).componentInstance;

    expect(component.moduleViews().map((module) => module.id)).toEqual([1]);
  });

  it('oculta el tema cuyos subtemas están todos sin bloques', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 3, 0)])).componentInstance;

    expect(component.moduleViews().map((module) => module.id)).toEqual([1]);
  });

  it('oculta solo los subtemas sin bloques dentro de un tema mixto', async () => {
    const [withBlocks] = buildModule(1, 1).lessons;
    const [withoutBlocks] = buildModule(2, 1, 0).lessons;
    const mixed: ModuleWithLessonCounts = {
      ...buildModule(1, 0),
      lessons: [withBlocks, withoutBlocks],
    };

    const component = (await setup([mixed])).componentInstance;
    const [view] = component.moduleViews();

    expect(view.lessons.map((item) => item.lesson.id)).toEqual([withBlocks.id]);
  });

  it('lo oculto no rompe la cadena ni cuenta en el progreso', async () => {
    // El tema vacío del medio no consume posición: completar el tema 1 abre directamente el 3.
    const component = (
      await setup(
        [buildModule(1, 2), buildModule(2, 3, 0), buildModule(3, 2)],
        [progressRow(100), progressRow(101)],
      )
    ).componentInstance;
    const views = component.moduleViews();

    expect(views.flatMap((module) => module.lessons).map((item) => item.status)).toEqual([
      'completed',
      'completed',
      'available',
      'locked',
    ]);
    expect(component.progress()).toBe(50);
  });

  it('muestra el error cuando falla la carga', async () => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.rejectWith(new Error('boom'));

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getForStudent',
    ]);
    progressService.getForStudent.and.resolveTo([]);

    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue({ id: 'usuario-1' } as never);

    TestBed.configureTestingModule({
      imports: [LearningModules],
      providers: [
        { provide: ModuleService, useValue: moduleService },
        { provide: ProgressService, useValue: progressService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    });

    const fixture = TestBed.createComponent(LearningModules);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toContain('No se pudieron cargar');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
