import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { LessonProgress } from '@domain/learning/models/lesson-progress-model';
import { ModuleWithLessonCounts } from '@domain/learning/models/module-with-lesson-counts';
import { StudentExercise } from '@domain/learning/models/student-exercise';
import {
  SIN_ACTIVIDAD,
  TutorActivity,
  TutorActivityService,
} from '@domain/ai/services/tutor-activity-service';
import { AttemptService, ExerciseAttemptSummary } from '@domain/learning/services/attempt-service';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';
import { of } from 'rxjs';

import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  /** Tema con `count` subtemas; ids de corrido para no repetirlos entre temas. */
  const buildModule = (id: number, count: number, blocksPerLesson = 1): ModuleWithLessonCounts => ({
    id,
    name: `Tema ${id}`,
    order: id,
    is_published: true,
    lessons: Array.from({ length: count }, (_, index) => ({
      id: id * 100 + index,
      name: `Subtema ${id}.${index}`,
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

  const exercise = (id: number, passed: boolean, lessonId = 100): StudentExercise => ({
    id,
    lesson_id: lessonId,
    name: `Ejercicio ${id}`,
    difficulty: 'facil',
    order: id,
    passed,
  });

  /** Un resumen de envíos: cuántos, y el veredicto del último. */
  const resumen = (intentos: number, criterios: boolean[] = []): ExerciseAttemptSummary => ({
    intentos,
    ultimoResultado: criterios.map((passed, i) => ({ description: `Criterio ${i}`, passed })),
  });

  interface Opciones {
    modules?: ModuleWithLessonCounts[];
    progress?: LessonProgress[];
    exercises?: StudentExercise[];
    attempts?: Map<number, ExerciseAttemptSummary>;
    tutor?: TutorActivity;
    isTeacher?: boolean;
  }

  const setup = async (opciones: Opciones = {}) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.resolveTo(opciones.modules ?? [buildModule(1, 3)]);

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getForStudent',
    ]);
    progressService.getForStudent.and.resolveTo(opciones.progress ?? []);

    const exerciseService = jasmine.createSpyObj<ExerciseService>('ExerciseService', [
      'getPublishedForStudent',
    ]);
    exerciseService.getPublishedForStudent.and.resolveTo(opciones.exercises ?? []);

    const attemptService = jasmine.createSpyObj<AttemptService>('AttemptService', [
      'getAttemptSummary',
    ]);
    attemptService.getAttemptSummary.and.resolveTo(opciones.attempts ?? new Map());

    const tutorActivityService = jasmine.createSpyObj<TutorActivityService>(
      'TutorActivityService',
      ['getMyActivity'],
    );
    tutorActivityService.getMyActivity.and.resolveTo(opciones.tutor ?? SIN_ACTIVIDAD);

    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser'], {
      isTeacher$: of(opciones.isTeacher ?? false),
    });
    authService.getCurrentUser.and.returnValue({ id: 'usuario-1' } as never);

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: ModuleService, useValue: moduleService },
        { provide: ProgressService, useValue: progressService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: AttemptService, useValue: attemptService },
        { provide: TutorActivityService, useValue: tutorActivityService },
        { provide: AuthService, useValue: authService },
      ],
    });

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  /** El estado que verán todos los participantes el primer día. */
  it('sin progreso invita a empezar por el primer subtema', async () => {
    await setup({ modules: [buildModule(1, 3), buildModule(2, 2)] });

    expect(component.estado()).toBe('empezar');
    expect(component.siguientePaso()?.lessonId).toBe(100);
    expect(texto()).toContain('Empieza por aquí');
  });

  it('con algo a medias invita a continuar por ESE subtema', async () => {
    await setup({
      modules: [buildModule(1, 3)],
      progress: [progressRow(100), progressRow(101, 'in_progress')],
    });

    expect(component.estado()).toBe('continuar');
    expect(component.siguientePaso()?.lessonId).toBe(101);
    expect(texto()).toContain('Continúa donde ibas');
  });

  /** Lo empezado manda sobre lo nuevo: devolverlo a lo que dejó a medias es mejor consejo. */
  it('prefiere lo empezado antes que el siguiente sin abrir', async () => {
    await setup({
      modules: [buildModule(1, 3)],
      progress: [progressRow(100, 'in_progress'), progressRow(101, 'in_progress')],
    });

    expect(component.siguientePaso()?.lessonId).toBe(100);
  });

  it('con todo completado no ofrece ningún subtema', async () => {
    await setup({
      modules: [buildModule(1, 2)],
      progress: [progressRow(100), progressRow(101)],
    });

    expect(component.estado()).toBe('completado');
    expect(component.siguientePaso()).toBeNull();
    expect(texto()).toContain('Completaste el recorrido');
  });

  /** Sin contenido no puede haber enlace: apuntaría a un subtema que no existe. */
  it('sin contenido publicado lo dice y no ofrece enlace', async () => {
    await setup({ modules: [buildModule(1, 2, 0)] });

    expect(component.estado()).toBe('sin-contenido');
    expect(component.siguientePaso()).toBeNull();
    expect(texto()).toContain('Todavía no hay contenido');
  });

  /**
   * La razón de calcular con `orderedLessons` en vez de con `get_student_context()`: los subtemas
   * sin bloques no se leen, así que no pueden contar en el denominador. Si contaran, Inicio diría
   * una cifra y Contenido otra.
   */
  it('las cifras cuentan solo los subtemas con contenido', async () => {
    const conBloques = buildModule(1, 2);
    const sinBloques = buildModule(2, 5, 0);

    await setup({ modules: [conBloques, sinBloques], progress: [progressRow(100)] });

    expect(component.subtemas()).toEqual({ completados: 1, total: 2 });
    expect(component.porcentaje()).toBe(50);
  });

  it('cuenta los ejercicios aprobados sobre el total publicado', async () => {
    await setup({ exercises: [exercise(1, true), exercise(2, false), exercise(3, true)] });

    expect(component.ejercicios()).toEqual({ aprobados: 2, total: 3 });
  });

  /**
   * El botón navega por código y no con `[routerLink]`: sobre `p-button` el directivo se monta y
   * resuelve bien la URL, pero el clic no lo dispara. Se comprobó en el navegador, y por eso hay
   * test: es el tipo de fallo que no se ve hasta que alguien pulsa.
   */
  describe('la navegación de la tarjeta principal', () => {
    it('lleva al subtema que propone', async () => {
      await setup({
        modules: [buildModule(1, 3)],
        progress: [progressRow(100), progressRow(101, 'in_progress')],
      });
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      component.irAlSiguiente();

      expect(navigate).toHaveBeenCalledWith(['/learning/modules', 1, 'lessons', 101]);
    });

    it('no navega a ningún sitio si no hay subtema que proponer', async () => {
      await setup({ modules: [buildModule(1, 2, 0)] });
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      component.irAlSiguiente();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('con todo completado lleva a la práctica libre', async () => {
      await setup({ modules: [buildModule(1, 1)], progress: [progressRow(100)] });
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      component.irAPracticaLibre();

      expect(navigate).toHaveBeenCalledWith(['/playground']);
    });
  });

  describe('progreso por tema', () => {
    it('cuenta los subtemas completados de cada tema', async () => {
      await setup({
        modules: [buildModule(1, 2), buildModule(2, 2)],
        progress: [progressRow(100), progressRow(101), progressRow(200)],
      });

      expect(
        component.temas().map((t) => [t.nombre, t.completados, t.total, t.porcentaje]),
      ).toEqual([
        ['Tema 1', 2, 2, 100],
        ['Tema 2', 1, 2, 50],
      ]);
    });

    /** `orderedLessons` los descarta antes: prometer un tema que no se puede leer sería mentir. */
    it('deja fuera un tema sin subtemas con contenido', async () => {
      await setup({ modules: [buildModule(1, 2), buildModule(2, 3, 0)] });

      expect(component.temas().map((t) => t.nombre)).toEqual(['Tema 1']);
    });

    it('marca como bloqueado el tema al que todavía no se llega', async () => {
      await setup({ modules: [buildModule(1, 2), buildModule(2, 2)] });

      expect(component.temas().map((t) => t.bloqueado)).toEqual([false, true]);
    });

    it('lo desbloquea al completar el tema anterior', async () => {
      await setup({
        modules: [buildModule(1, 2), buildModule(2, 2)],
        progress: [progressRow(100), progressRow(101)],
      });

      expect(component.temas().map((t) => t.bloqueado)).toEqual([false, false]);
    });
  });

  describe('comprobaciones superadas', () => {
    /**
     * La cifra que arregla el «0 de 1»: quien se queda a un criterio no está igual que quien no lo
     * ha intentado.
     */
    it('suma los criterios del último intento de cada ejercicio', async () => {
      await setup({
        exercises: [exercise(1, false), exercise(2, false)],
        attempts: new Map([
          [1, resumen(3, [true, true, false])],
          [2, resumen(1, [true, false])],
        ]),
      });

      expect(component.comprobaciones()).toEqual({ superadas: 3, total: 5 });
      expect(texto()).toContain('Comprobaciones');
    });

    /** Un ejercicio sin intentos no dice nada del estudiante, así que no entra en el denominador. */
    it('no cuenta los ejercicios que no ha intentado', async () => {
      await setup({ exercises: [exercise(1, false), exercise(2, false)] });

      expect(component.comprobaciones()).toEqual({ superadas: 0, total: 0 });
    });

    it('no pinta la fila cuando no hay nada que contar', async () => {
      await setup({ exercises: [exercise(1, false)] });

      expect(texto()).not.toContain('Comprobaciones');
    });
  });

  describe('el siguiente ejercicio', () => {
    it('propone el primero sin aprobar de un subtema con los ejercicios abiertos', async () => {
      await setup({
        modules: [buildModule(1, 2)],
        progress: [progressRow(100)],
        exercises: [exercise(7, false, 100), exercise(8, false, 100)],
      });

      expect(component.siguienteEjercicio()?.id).toBe(7);
      expect(texto()).toContain('Tu siguiente ejercicio');
    });

    it('salta los que ya están aprobados', async () => {
      await setup({
        modules: [buildModule(1, 2)],
        progress: [progressRow(100)],
        exercises: [exercise(7, true, 100), exercise(8, false, 100)],
      });

      expect(component.siguienteEjercicio()?.id).toBe(8);
    });

    /**
     * Los ejercicios de un subtema se abren cuando el anterior está completado; ofrecer uno de un
     * subtema cerrado mandaría al estudiante a una pantalla bloqueada.
     */
    it('no propone uno de un subtema cuyos ejercicios siguen cerrados', async () => {
      await setup({
        modules: [buildModule(1, 2)],
        progress: [progressRow(100, 'in_progress')],
        exercises: [exercise(7, false, 101)],
      });

      expect(component.siguienteEjercicio()).toBeNull();
    });

    it('sin ninguno pendiente lo dice en vez de dejar el hueco', async () => {
      await setup({ modules: [buildModule(1, 2)], exercises: [] });

      expect(component.siguienteEjercicio()).toBeNull();
      expect(texto()).toContain('Los ejercicios de un subtema se abren');
    });
  });

  describe('la tarjeta del tutor', () => {
    it('muestra las cifras de uso', async () => {
      await setup({
        tutor: {
          preguntas: 12,
          pistas: 5,
          practicas: 3,
          ultima: { tipo: 'question', cuando: '2026-09-01T10:00:00Z', subtema: 'Etiquetas' },
        },
      });

      expect(component.usoElTutor()).toBeTrue();
      expect(texto()).toContain('12');
      expect(texto()).toContain('Etiquetas');
    });

    /** Es accesoria: si su lectura falla —o falta la migración—, el panel sigue en pie. */
    it('si su lectura falla, el resto del panel sigue funcionando', async () => {
      await setup({ modules: [buildModule(1, 2)], progress: [progressRow(100)] });
      const tutorActivityService = TestBed.inject(
        TutorActivityService,
      ) as jasmine.SpyObj<TutorActivityService>;
      tutorActivityService.getMyActivity.and.rejectWith(new Error('42501'));

      await component.fetchAll();
      fixture.detectChanges();

      expect(component.error()).toBeNull();
      expect(component.usoElTutor()).toBeFalse();
      expect(component.estado()).toBe('continuar');
    });

    /**
     * A diferencia de los atascos, esta no se esconde: para un estudiante nuevo —el caso de todos
     * el primer día— decirle que el tutor existe vale más que un hueco.
     */
    it('sin uso invita en vez de esconderse', async () => {
      await setup();

      expect(component.usoElTutor()).toBeFalse();
      expect(texto()).toContain('Tu tutor');
      expect(texto()).toContain('Todavía no le has preguntado nada');
    });
  });

  describe('dónde se está atascando', () => {
    it('lista los intentados y nunca aprobados, de más intentos a menos', async () => {
      await setup({
        exercises: [exercise(1, false), exercise(2, false)],
        attempts: new Map([
          [1, resumen(2)],
          [2, resumen(7)],
        ]),
      });

      expect(component.atascos().map((a) => a.exerciseId)).toEqual([2, 1]);
      expect(component.atascos()[0].intentos).toBe(7);
      expect(texto()).toContain('Dónde te estás atascando');
    });

    /** Un ejercicio sin intentos no es un atasco: es uno sin empezar. */
    it('deja fuera lo que no se ha intentado', async () => {
      await setup({ exercises: [exercise(1, false)], attempts: new Map() });

      expect(component.atascos()).toEqual([]);
    });

    it('deja fuera lo ya aprobado aunque costara muchos intentos', async () => {
      await setup({ exercises: [exercise(1, true)], attempts: new Map([[1, resumen(9)]]) });

      expect(component.atascos()).toEqual([]);
    });

    it('no pinta la sección cuando no hay nada atascado', async () => {
      await setup({ exercises: [exercise(1, true)] });

      expect(texto()).not.toContain('Dónde te estás atascando');
    });

    it('se queda en tres para no agobiar', async () => {
      await setup({
        exercises: [1, 2, 3, 4, 5].map((id) => exercise(id, false)),
        attempts: new Map([1, 2, 3, 4, 5].map((id) => [id, resumen(id)] as const)),
      });

      expect(component.atascos().length).toBe(3);
      expect(component.atascos().map((a) => a.exerciseId)).toEqual([5, 4, 3]);
    });
  });

  describe('el acceso del profesor', () => {
    it('no aparece para un estudiante', async () => {
      await setup({ isTeacher: false });
      expect(texto()).not.toContain('Enseñar');
    });

    it('aparece para quien tiene el rol', async () => {
      await setup({ isTeacher: true });
      expect(texto()).toContain('Enseñar');
    });
  });

  it('avisa cuando no hay sesión en vez de pedir datos', async () => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser'], {
      isTeacher$: of(false),
    });
    authService.getCurrentUser.and.returnValue(undefined as never);

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: ModuleService, useValue: moduleService },
        { provide: ProgressService, useValue: {} },
        { provide: ExerciseService, useValue: {} },
        { provide: AttemptService, useValue: {} },
        { provide: TutorActivityService, useValue: {} },
        { provide: AuthService, useValue: authService },
      ],
    });

    const fixture2 = TestBed.createComponent(Dashboard);
    fixture2.detectChanges();
    await fixture2.whenStable();

    expect(fixture2.componentInstance.error()).toContain('No se pudo identificar la sesión');
    expect(moduleService.getLearningTree).not.toHaveBeenCalled();
  });

  it('muestra el error cuando falla la carga', async () => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getLearningTree']);
    moduleService.getLearningTree.and.rejectWith(new Error('boom'));

    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser'], {
      isTeacher$: of(false),
    });
    authService.getCurrentUser.and.returnValue({ id: 'usuario-1' } as never);

    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'getForStudent',
    ]);
    progressService.getForStudent.and.resolveTo([]);

    const exerciseService = jasmine.createSpyObj<ExerciseService>('ExerciseService', [
      'getPublishedForStudent',
    ]);
    exerciseService.getPublishedForStudent.and.resolveTo([]);

    const attemptService = jasmine.createSpyObj<AttemptService>('AttemptService', [
      'getAttemptSummary',
    ]);
    attemptService.getAttemptSummary.and.resolveTo(new Map());

    const tutorActivityService = jasmine.createSpyObj<TutorActivityService>(
      'TutorActivityService',
      ['getMyActivity'],
    );
    tutorActivityService.getMyActivity.and.resolveTo(SIN_ACTIVIDAD);

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: ModuleService, useValue: moduleService },
        { provide: ProgressService, useValue: progressService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: AttemptService, useValue: attemptService },
        { provide: TutorActivityService, useValue: tutorActivityService },
        { provide: AuthService, useValue: authService },
      ],
    });

    const fixture2 = TestBed.createComponent(Dashboard);
    fixture2.detectChanges();
    await fixture2.whenStable();

    expect(fixture2.componentInstance.error()).toContain('No se pudo cargar tu panel');
    expect(fixture2.componentInstance.loading()).toBeFalse();
  });
});
