import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@core/services/auth/auth-service';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { StudentExercise } from '@domain/learning/models/student-exercise';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';

import { LearningExercises } from './learning-exercises';

describe('LearningExercises', () => {
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

  const exercise = (id: number, lessonId: number, passed = false): StudentExercise => ({
    id,
    lesson_id: lessonId,
    name: `Ejercicio ${id}`,
    difficulty: 'media',
    order: id,
    passed,
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

  const setup = async (options: {
    modules: ModuleWithLessonCounts[];
    exercises?: StudentExercise[];
    progress?: LessonProgress[];
    userId?: string | null;
  }) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.resolveTo(options.modules);

    const exerciseService = jasmine.createSpyObj<ExerciseService>('ExerciseService', [
      'getPublishedForStudent',
    ]);
    exerciseService.getPublishedForStudent.and.resolveTo(options.exercises ?? []);

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getMyProgress',
    ]);
    progressService.getMyProgress.and.resolveTo(options.progress ?? []);

    const userId = options.userId === undefined ? 'usuario-1' : options.userId;
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue(userId ? ({ id: userId } as never) : null);

    TestBed.configureTestingModule({
      imports: [LearningExercises],
      providers: [
        { provide: ModuleService, useValue: moduleService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: ProgressService, useValue: progressService },
        { provide: AuthService, useValue: authService },
      ],
    });

    const fixture: ComponentFixture<LearningExercises> = TestBed.createComponent(LearningExercises);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, exerciseService };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    expect((await setup({ modules: [] })).component).toBeTruthy();
  });

  it('agrupa cada ejercicio bajo su subtema', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 2)],
      exercises: [exercise(1, 100), exercise(2, 100), exercise(3, 101)],
    });
    const [tema] = component.moduleViews();

    expect(tema.lessons.map((lesson) => lesson.exercises.length)).toEqual([2, 1]);
  });

  it('el primer subtema tiene sus ejercicios pendientes y el siguiente, bloqueados', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 2)],
      exercises: [exercise(1, 100), exercise(2, 101)],
    });
    const [primero, segundo] = component.moduleViews()[0].lessons;

    expect(primero.exercises[0].status).toBe('pending');
    expect(primero.locked).toBeFalse();
    expect(segundo.exercises[0].status).toBe('locked');
    expect(segundo.locked).toBeTrue();
  });

  /**
   * La diferencia con la vista de contenido: ahí basta con haber abierto el subtema anterior, aquí
   * hace falta haberlo completado.
   */
  it('haber abierto el subtema anterior no basta para abrir sus ejercicios', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 2)],
      exercises: [exercise(1, 101)],
      progress: [progressRow(100, 'in_progress')],
    });

    expect(component.moduleViews()[0].lessons[1].locked).toBeTrue();
  });

  it('completar el subtema anterior abre los ejercicios del siguiente', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 2)],
      exercises: [exercise(1, 101)],
      progress: [progressRow(100)],
    });

    expect(component.moduleViews()[0].lessons[1].locked).toBeFalse();
    expect(component.moduleViews()[0].lessons[1].exercises[0].status).toBe('pending');
  });

  it('cuenta los aprobados en la barra del subtema', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 1)],
      exercises: [exercise(1, 100, true), exercise(2, 100), exercise(3, 100)],
    });
    const [lesson] = component.moduleViews()[0].lessons;

    expect(lesson.passed).toBe(1);
    expect(lesson.total).toBe(3);
    expect(lesson.percent).toBe(33);
  });

  /**
   * El badge «Nuevo» sin mirar ninguna fecha: si el subtema está completado, todos sus ejercicios
   * estaban aprobados, así que uno sin aprobar llegó después.
   */
  it('marca como nuevo el ejercicio sin aprobar de un subtema ya completado', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 1)],
      exercises: [exercise(1, 100, true), exercise(2, 100)],
      progress: [progressRow(100)],
    });
    const [lesson] = component.moduleViews()[0].lessons;

    expect(lesson.completed).toBeTrue();
    expect(lesson.exercises.map((item) => item.status)).toEqual(['passed', 'new']);
  });

  it('un subtema sin ejercicios se explica en vez de quedar vacío', async () => {
    const { component } = await setup({ modules: [buildModule(1, 1)] });
    const [lesson] = component.moduleViews()[0].lessons;

    expect(lesson.total).toBe(0);
    expect(lesson.exercises).toEqual([]);
  });

  it('bloquea el tema cuyos subtemas están todos bloqueados', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 1), buildModule(2, 1)],
      exercises: [exercise(1, 100), exercise(2, 200)],
    });

    expect(component.moduleViews()[0].locked).toBeFalse();
    expect(component.moduleViews()[1].locked).toBeTrue();
  });

  it('resume los ejercicios resueltos de todo el curso', async () => {
    const { component } = await setup({
      modules: [buildModule(1, 2)],
      exercises: [exercise(1, 100, true), exercise(2, 100), exercise(3, 101)],
      progress: [progressRow(100, 'in_progress')],
    });

    expect(component.summary()).toEqual({ passed: 1, total: 3, percent: 33 });
  });

  /** El id del usuario acota el embed de intentos; sin sesión no hay nada fiable que pintar. */
  it('pide los ejercicios acotados al usuario en sesión', async () => {
    const { exerciseService } = await setup({ modules: [buildModule(1, 1)] });

    expect(exerciseService.getPublishedForStudent).toHaveBeenCalledWith('usuario-1');
  });

  it('avisa en vez de cargar cuando no hay sesión', async () => {
    const { component, exerciseService } = await setup({ modules: [], userId: null });

    expect(component.error()).toContain('sesión');
    expect(component.loading()).toBeFalse();
    expect(exerciseService.getPublishedForStudent).not.toHaveBeenCalled();
  });

  it('muestra el error cuando falla la carga', async () => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.rejectWith(new Error('boom'));

    const exerciseService = jasmine.createSpyObj<ExerciseService>('ExerciseService', [
      'getPublishedForStudent',
    ]);
    exerciseService.getPublishedForStudent.and.resolveTo([]);

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getMyProgress',
    ]);
    progressService.getMyProgress.and.resolveTo([]);

    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue({ id: 'usuario-1' } as never);

    TestBed.configureTestingModule({
      imports: [LearningExercises],
      providers: [
        { provide: ModuleService, useValue: moduleService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: ProgressService, useValue: progressService },
        { provide: AuthService, useValue: authService },
      ],
    });

    const fixture = TestBed.createComponent(LearningExercises);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toContain('No se pudieron cargar');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });
});
