import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { ConfirmationService } from 'primeng/api';
import { AuthService } from '@core/services/auth/auth-service';
import { ValidationOutcome } from '@domain/code-runner/validation/probe-model';
import { ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import { StudentExerciseDetail } from '@domain/learning/models/student-exercise-detail';
import { AttemptDraft, AttemptService } from '@domain/learning/services/attempt-service';
import { ExerciseService } from '@domain/learning/services/exercise-service';
import { PreviewPanel } from '@shared/components/preview-panel/preview-panel';

import { LearningExercise } from './learning-exercise';

describe('LearningExercise', () => {
  const criterion = (description: string): ExerciseCriterion => ({
    type: 'element_exists',
    description,
    selector: 'h1',
  });

  const buildExercise = (
    overrides: Partial<StudentExerciseDetail> = {},
  ): StudentExerciseDetail => ({
    id: 7,
    lesson_id: 100,
    name: 'Tu primer título',
    statement: '# Escribe un título',
    difficulty: 'facil',
    starter_html: '<!-- aquí -->',
    starter_css: '',
    starter_js: '',
    criteria: [criterion('Existe un h1')],
    passed: false,
    ...overrides,
  });

  const outcome = (overrides: Partial<ValidationOutcome> = {}): ValidationOutcome => ({
    results: [{ description: 'Existe un h1', passed: true }],
    passed: true,
    timedOut: false,
    ...overrides,
  });

  const setup = async (options: {
    exercise?: StudentExerciseDetail;
    draft?: AttemptDraft | null;
    failing?: boolean;
    userId?: string | null;
    exerciseId?: string;
  }) => {
    const exerciseService = jasmine.createSpyObj<ExerciseService>('ExerciseService', [
      'getForStudent',
    ]);

    if (options.failing) {
      exerciseService.getForStudent.and.rejectWith(new Error('no existe'));
    } else {
      exerciseService.getForStudent.and.resolveTo(options.exercise ?? buildExercise());
    }

    const attemptService = jasmine.createSpyObj<AttemptService>('AttemptService', [
      'submitAttempt',
      'getLastAttempt',
    ]);
    attemptService.submitAttempt.and.resolveTo();
    attemptService.getLastAttempt.and.resolveTo(options.draft ?? null);

    const userId = options.userId === undefined ? 'usuario-1' : options.userId;
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue(userId ? ({ id: userId } as never) : null);

    TestBed.configureTestingModule({
      imports: [LearningExercise],
      providers: [
        provideRouter([]),
        // `MarkdownRenderer` depende de ngx-markdown, que en la app se registra en `app.config.ts`.
        importProvidersFrom(MarkdownModule.forRoot()),
        { provide: ExerciseService, useValue: exerciseService },
        { provide: AttemptService, useValue: attemptService },
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ exerciseId: options.exerciseId ?? '7' }) },
          },
        },
      ],
    });

    const fixture: ComponentFixture<LearningExercise> = TestBed.createComponent(LearningExercise);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance, exerciseService, attemptService };
  };

  /**
   * Se espía el `PreviewPanel` real en lugar de sustituirlo por un doble: `viewChild(PreviewPanel)`
   * busca por tipo, así que una clase impostora no la encontraría. Espiar el método deja fuera el
   * iframe —que es lo que no se puede controlar desde una prueba— sin tocar el cableado.
   */
  const stubValidation = (
    fixture: ComponentFixture<LearningExercise>,
    result: ValidationOutcome,
  ) => {
    const panel = fixture.debugElement.query(By.directive(PreviewPanel))
      .componentInstance as PreviewPanel;

    return spyOn(panel, 'runValidation').and.resolveTo(result);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    expect((await setup({})).component).toBeTruthy();
  });

  it('carga el código inicial en el editor', async () => {
    const { component } = await setup({
      exercise: buildExercise({ starter_html: '<p>base</p>', starter_css: 'p { color: red }' }),
    });

    expect(component.code()).toEqual({
      html: '<p>base</p>',
      css: 'p { color: red }',
      js: '',
    });
  });

  it('pide el ejercicio acotado al usuario en sesión', async () => {
    const { exerciseService } = await setup({});

    expect(exerciseService.getForStudent).toHaveBeenCalledWith(7, 'usuario-1');
  });

  it('muestra los criterios sin veredicto antes del primer envío', async () => {
    const { component } = await setup({});

    expect(component.criteria()).toEqual([{ description: 'Existe un h1', passed: null }]);
  });

  it('enviar valida y registra el intento con su resultado', async () => {
    const { fixture, component, attemptService } = await setup({});
    const runValidation = stubValidation(fixture, outcome());

    await component.submit();

    expect(runValidation).toHaveBeenCalled();
    expect(attemptService.submitAttempt).toHaveBeenCalledWith({
      exerciseId: 7,
      code: { html: '<!-- aquí -->', css: '', js: '' },
      passed: true,
      results: [{ description: 'Existe un h1', passed: true }],
    });
    expect(component.passed()).toBeTrue();
  });

  /** Se guardan todos los envíos, no solo el que aprueba: el historial es el dato que importa. */
  it('registra también el intento fallido', async () => {
    const { fixture, component, attemptService } = await setup({});
    stubValidation(
      fixture,
      outcome({ passed: false, results: [{ description: 'Existe un h1', passed: false }] }),
    );

    await component.submit();

    expect(attemptService.submitAttempt).toHaveBeenCalled();
    expect(attemptService.submitAttempt.calls.mostRecent().args[0].passed).toBeFalse();
    expect(component.passed()).toBeFalse();
    expect(component.criteria()).toEqual([{ description: 'Existe un h1', passed: false }]);
  });

  /**
   * Agotar el tiempo no es fallar los criterios: el código nunca contestó. El intento se registra
   * igual —el estudiante envió algo— y la vista lo distingue para no decirle que su HTML está mal
   * cuando lo que tiene es un bucle infinito.
   */
  it('registra el intento aunque la validación agote el tiempo', async () => {
    const { fixture, component, attemptService } = await setup({});
    stubValidation(
      fixture,
      outcome({
        passed: false,
        timedOut: true,
        results: [{ description: 'Existe un h1', passed: false }],
      }),
    );

    await component.submit();

    expect(attemptService.submitAttempt).toHaveBeenCalled();
    expect(component.outcome()?.timedOut).toBeTrue();
  });

  /** El resultado se enseña aunque la escritura falle: es lo que el estudiante estaba esperando. */
  it('muestra el resultado aunque no se pueda registrar el intento', async () => {
    const { fixture, component, attemptService } = await setup({});
    stubValidation(fixture, outcome());
    attemptService.submitAttempt.and.rejectWith(new Error('sin conexión'));

    await component.submit();

    expect(component.outcome()?.passed).toBeTrue();
    expect(component.submitError()).toContain('sin conexión');
  });

  /**
   * La base cuenta los ejercicios con ALGÚN intento aprobado, así que seguir editando después no
   * desaprueba nada. La vista tiene que decir lo mismo para no contradecirla.
   */
  it('un ejercicio ya aprobado se muestra aprobado al abrirlo', async () => {
    const { component } = await setup({ exercise: buildExercise({ passed: true }) });

    expect(component.passed()).toBeTrue();
  });

  it('seguir intentando no desaprueba un ejercicio ya aprobado', async () => {
    const { fixture, component } = await setup({ exercise: buildExercise({ passed: true }) });
    stubValidation(
      fixture,
      outcome({ passed: false, results: [{ description: 'Existe un h1', passed: false }] }),
    );

    await component.submit();

    expect(component.passed()).toBeTrue();
  });

  /* ─── El borrador: el último envío ─── */

  const draftOf = (html: string): AttemptDraft => ({
    code: { html, css: '', js: '' },
    passed: false,
    createdAt: '2026-09-22T10:00:00Z',
  });

  /**
   * Sin esto, salir de la vista borraba el trabajo del estudiante: al volver aparecía otra vez el
   * código inicial. El envío ya estaba guardado en `exercise_attempts`; lo que faltaba era leerlo.
   */
  it('retoma el último envío en lugar del código inicial', async () => {
    const { component } = await setup({ draft: draftOf('<h1>lo mío</h1>') });

    expect(component.code().html).toBe('<h1>lo mío</h1>');
    expect(component.draft()).not.toBeNull();
  });

  it('carga el código inicial cuando nunca se envió nada', async () => {
    const { component } = await setup({ draft: null });

    expect(component.code().html).toBe('<!-- aquí -->');
    expect(component.draft()).toBeNull();
  });

  it('pide el último envío acotado al usuario y al ejercicio', async () => {
    const { attemptService } = await setup({});

    expect(attemptService.getLastAttempt).toHaveBeenCalledWith(7, 'usuario-1');
  });

  /** El aviso explica por qué el editor no trae el código inicial; tras enviar ya no aplica. */
  it('deja de anunciar el envío retomado en cuanto se vuelve a enviar', async () => {
    const { fixture, component } = await setup({ draft: draftOf('<h1>lo mío</h1>') });
    stubValidation(fixture, outcome());

    await component.submit();

    expect(component.draft()).toBeNull();
  });

  /**
   * Reiniciar vuelve al código inicial aunque se hubiera retomado un envío: el botón existe para
   * deshacer el propio trabajo, así que restaurar el envío anterior no sería reiniciar nada.
   */
  it('reiniciar devuelve al código inicial, no al envío retomado', async () => {
    const { fixture, component } = await setup({ draft: draftOf('<h1>lo mío</h1>') });

    // `onReset` pide confirmación; la prueba acepta por el estudiante.
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmation, 'confirm').and.callFake((options) => {
      options.accept?.();
      return confirmation;
    });

    component.onReset();

    expect(component.code().html).toBe('<!-- aquí -->');
    expect(component.draft()).toBeNull();
  });

  /* ─── El aviso del resultado ─── */

  it('no dice nada antes del primer envío', async () => {
    const { component } = await setup({});

    expect(component.resultMessage()).toBeNull();
  });

  /**
   * Regresión de un fallo visto en el navegador: con tres `@if` separados, PrimeNG dejaba el
   * mensaje anterior en pantalla y creaba el nuevo con altura cero, de modo que al aprobar se
   * seguía leyendo «todavía no cumple». Por eso el aviso es uno solo y se comprueba aquí que al
   * pasar de fallo a acierto queda un único mensaje, y es el correcto.
   */
  it('al aprobar reemplaza el aviso de fallo en vez de acumularlo', async () => {
    const { fixture, component } = await setup({});
    const failing = stubValidation(
      fixture,
      outcome({ passed: false, results: [{ description: 'Existe un h1', passed: false }] }),
    );

    await component.submit();
    expect(component.resultMessage()?.severity).toBe('error');

    failing.and.resolveTo(outcome());
    await component.submit();
    fixture.detectChanges();

    expect(component.resultMessage()).toEqual({
      severity: 'success',
      text: '¡Correcto! Cumple todos los criterios.',
    });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.work-column p-message').length)
      .withContext('debe quedar un solo aviso en pantalla')
      .toBe(1);
  });

  it('distingue el tiempo agotado de un fallo de criterios', async () => {
    const { fixture, component } = await setup({});
    stubValidation(
      fixture,
      outcome({
        passed: false,
        timedOut: true,
        results: [{ description: 'Existe un h1', passed: false }],
      }),
    );

    await component.submit();

    expect(component.resultMessage()?.severity).toBe('warn');
    expect(component.resultMessage()?.text).toContain('bucle infinito');
  });

  /** `hasPassed` exige al menos un criterio, así que sin ellos no hay forma de aprobar. */
  it('avisa de que un ejercicio sin criterios no puede resolverse', async () => {
    const { component } = await setup({ exercise: buildExercise({ criteria: [] }) });

    expect(component.unsolvable()).toBeTrue();
  });

  it('un ejercicio que no está disponible se explica en vez de quedar en blanco', async () => {
    const { component } = await setup({ failing: true });

    expect(component.error()).toBe('Este ejercicio no está disponible.');
    expect(component.exercise()).toBeNull();
  });

  it('no consulta nada si no hay sesión', async () => {
    const { component, exerciseService } = await setup({ userId: null });

    expect(exerciseService.getForStudent).not.toHaveBeenCalled();
    expect(component.error()).toContain('sesión');
  });

  it('rechaza un id de ejercicio que no es un número', async () => {
    const { component, exerciseService } = await setup({ exerciseId: 'abc' });

    expect(exerciseService.getForStudent).not.toHaveBeenCalled();
    expect(component.error()).toContain('no es válido');
  });
});
