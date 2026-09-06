import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { ModuleService } from '@domain/learning/services/module-service';

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

  const setup = async (modules: ModuleWithLessonCounts[]) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.resolveTo(modules);

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [LearningModules],
      providers: [
        { provide: ModuleService, useValue: moduleService },
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

  it('numera los subtemas de corrido entre temas para asignarles el estado', async () => {
    // Con el placeholder actual: 3 completados, el 4.º en curso y el resto bloqueados.
    const component = (await setup([buildModule(1, 2), buildModule(2, 3)])).componentInstance;
    const [first, second] = component.moduleViews();

    expect(first.lessons.map((item) => item.status)).toEqual(['completed', 'completed']);
    expect(second.lessons.map((item) => item.status)).toEqual([
      'completed',
      'in-progress',
      'locked',
    ]);
  });

  it('marca como bloqueado el tema cuyos subtemas lo están todos', async () => {
    const component = (await setup([buildModule(1, 4), buildModule(2, 2)])).componentInstance;

    expect(component.moduleViews()[0].locked).toBeFalse();
    expect(component.moduleViews()[1].locked).toBeTrue();
  });

  it('calcula el progreso sobre el total de subtemas del curso', async () => {
    const component = (await setup([buildModule(1, 6)])).componentInstance;

    expect(component.progress()).toBe(50);
  });

  it('abre el tema donde quedó el estudiante', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 3)])).componentInstance;

    expect(component.activePanel()).toBe(2);
  });

  it('no navega al hacer clic en un subtema bloqueado', async () => {
    const component = (await setup([buildModule(1, 5)])).componentInstance;
    const locked = component.moduleViews()[0].lessons[4];

    component.onLessonClick(1, locked);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navega al detalle del subtema desbloqueado', async () => {
    const component = (await setup([buildModule(1, 5)])).componentInstance;
    const available = component.moduleViews()[0].lessons[3];

    component.onLessonClick(1, available);

    expect(router.navigate).toHaveBeenCalledWith(['learning/modules/1/lessons/103']);
  });

  it('continúa en el subtema en curso', async () => {
    const component = (await setup([buildModule(1, 2), buildModule(2, 3)])).componentInstance;

    component.onResumeLearning();

    expect(component.canResume()).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['learning/modules/2/lessons/201']);
  });

  it('deshabilita "continuar" cuando no hay ningún subtema en curso', async () => {
    // Menos subtemas que el umbral del placeholder: todos quedan completados.
    const component = (await setup([buildModule(1, 2)])).componentInstance;

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

  it('no deja que lo oculto desplace los estados ni cuente en el progreso', async () => {
    // El tema vacío del medio no debe consumir posiciones del recorrido: con 4 subtemas visibles
    // el estado es el mismo que si nunca hubiera existido (3 completados + 1 en curso).
    const component = (await setup([buildModule(1, 2), buildModule(2, 3, 0), buildModule(3, 2)]))
      .componentInstance;
    const views = component.moduleViews();

    expect(views.flatMap((module) => module.lessons).map((item) => item.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'in-progress',
    ]);
    expect(component.progress()).toBe(75);
  });

  it('muestra el error cuando falla la carga', async () => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.rejectWith(new Error('boom'));

    TestBed.configureTestingModule({
      imports: [LearningModules],
      providers: [
        { provide: ModuleService, useValue: moduleService },
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
