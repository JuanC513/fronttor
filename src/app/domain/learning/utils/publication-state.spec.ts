import { Block } from '../models/block-model';
import { Exercise } from '../models/exercise-model';
import { Lesson } from '../models/lesson-model';
import { Module } from '../models/module-model';
import {
  describeBlockImpact,
  describeExerciseImpact,
  describeLessonImpact,
  describeModuleImpact,
  ExerciseScope,
  exercisePublicationBlock,
  resolveBlockStatus,
  resolveExerciseStatus,
  resolveLessonStatus,
  resolveModuleStatus,
} from './publication-state';

const module = (over: Partial<Module> = {}): Module => ({
  id: 1,
  name: 'HTML',
  order: 1,
  is_published: true,
  ...over,
});

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 10,
  name: 'Etiquetas',
  order: 1,
  module_id: 1,
  is_published: true,
  ...over,
});

const block = (over: Partial<Block> = {}): Block => ({
  id: 100,
  name: 'Introducción',
  content: '...',
  order: 1,
  lesson_id: 10,
  is_published: true,
  ...over,
});

describe('resolveBlockStatus', () => {
  it('marca borrador cuando no está publicado', () => {
    const status = resolveBlockStatus({
      block: block({ is_published: false }),
      lesson: lesson(),
      module: module(),
      siblingBlocks: [],
    });

    expect(status.state).toBe('draft');
  });

  it('marca no visible cuando su subtema está en borrador', () => {
    const status = resolveBlockStatus({
      block: block(),
      lesson: lesson({ is_published: false }),
      module: module(),
      siblingBlocks: [],
    });

    expect(status).toEqual({ state: 'hidden', reason: 'Su subtema está en borrador' });
  });

  it('culpa al tema antes que al subtema cuando ambos están en borrador', () => {
    // El ancestro domina: publicar el subtema no mostraría nada mientras el tema siga oculto.
    const status = resolveBlockStatus({
      block: block(),
      lesson: lesson({ is_published: false }),
      module: module({ is_published: false }),
      siblingBlocks: [],
    });

    expect(status.reason).toBe('Su tema está en borrador');
  });
});

describe('resolveLessonStatus', () => {
  const scope = (over: { lesson?: Lesson; module?: Module; blocks?: Block[] } = {}) => ({
    lesson: over.lesson ?? lesson(),
    module: over.module ?? module(),
    siblingLessons: [over.lesson ?? lesson()],
    blocks: over.blocks ?? [block()],
  });

  it('es visible con al menos un bloque publicado', () => {
    expect(resolveLessonStatus(scope()).state).toBe('published');
  });

  it('distingue no tener bloques de tenerlos todos en borrador', () => {
    expect(resolveLessonStatus(scope({ blocks: [] })).reason).toBe('No tiene bloques');
    expect(resolveLessonStatus(scope({ blocks: [block({ is_published: false })] })).reason).toBe(
      'Ninguno de sus bloques está publicado',
    );
  });

  it('ignora los bloques de otros subtemas', () => {
    const ajeno = block({ id: 999, lesson_id: 77 });
    expect(resolveLessonStatus(scope({ blocks: [ajeno] })).reason).toBe('No tiene bloques');
  });

  it('queda no visible por su tema aunque tenga bloques publicados', () => {
    const status = resolveLessonStatus(scope({ module: module({ is_published: false }) }));
    expect(status).toEqual({ state: 'hidden', reason: 'Su tema está en borrador' });
  });
});

describe('resolveModuleStatus', () => {
  it('distingue los tres motivos por los que un tema publicado no se ve', () => {
    const sinSubtemas = resolveModuleStatus({ module: module(), lessons: [], blocks: [] });
    expect(sinSubtemas.reason).toBe('No tiene subtemas');

    const enBorrador = resolveModuleStatus({
      module: module(),
      lessons: [lesson({ is_published: false })],
      blocks: [block()],
    });
    expect(enBorrador.reason).toBe('Ninguno de sus subtemas está publicado');

    const sinBloques = resolveModuleStatus({
      module: module(),
      lessons: [lesson()],
      blocks: [block({ is_published: false })],
    });
    expect(sinBloques.reason).toBe('Sus subtemas publicados no tienen bloques publicados');
  });

  it('es visible en cuanto un subtema lo es', () => {
    const status = resolveModuleStatus({
      module: module(),
      lessons: [lesson({ id: 10 }), lesson({ id: 11, is_published: false })],
      blocks: [block({ lesson_id: 10 })],
    });

    expect(status.state).toBe('published');
  });
});

describe('describeModuleImpact', () => {
  const scope = {
    module: module(),
    lessons: [lesson()],
    blocks: [block()],
  };

  it('no dice nada si el interruptor no se movió', () => {
    expect(describeModuleImpact(scope, true)).toBeNull();
  });

  it('avisa de lo que se oculta y marca la confirmación al guardar', () => {
    const impact = describeModuleImpact(scope, false)!;

    expect(impact.hides).toBeTrue();
    expect(impact.severity).toBe('warn');
    expect(impact.message).toContain('1 subtema');
  });

  it('explica por qué publicar no bastará', () => {
    const vacio = { module: module({ is_published: false }), lessons: [], blocks: [] };
    const impact = describeModuleImpact(vacio, true)!;

    expect(impact.hides).toBeFalse();
    expect(impact.severity).toBe('warn');
    expect(impact.message).toBe('Seguirá sin mostrarse a los estudiantes: no tiene subtemas.');
  });

  it('no alarma al despublicar algo que ya estaba oculto', () => {
    const oculto = { module: module(), lessons: [], blocks: [] };
    const impact = describeModuleImpact(oculto, false)!;

    expect(impact.hides).toBeFalse();
    expect(impact.severity).toBe('info');
  });
});

describe('describeLessonImpact', () => {
  it('avisa de que el tema cae con él si era el único subtema visible', () => {
    const impact = describeLessonImpact(
      {
        lesson: lesson(),
        module: module(),
        siblingLessons: [lesson()],
        blocks: [block()],
      },
      false,
    )!;

    expect(impact.message).toContain('«HTML» dejará de mostrarse');
  });

  it('no menciona la cascada si queda otro subtema visible', () => {
    const otro = lesson({ id: 11 });
    const impact = describeLessonImpact(
      {
        lesson: lesson(),
        module: module(),
        siblingLessons: [lesson(), otro],
        blocks: [block(), block({ id: 101, lesson_id: 11 })],
      },
      false,
    )!;

    expect(impact.message).not.toContain('dejará de mostrarse');
  });
});

describe('describeBlockImpact', () => {
  it('avisa de que se lleva el subtema por delante si es el último publicado', () => {
    const impact = describeBlockImpact(
      {
        block: block(),
        lesson: lesson(),
        module: module(),
        siblingBlocks: [block(), block({ id: 101, is_published: false })],
      },
      false,
    )!;

    expect(impact.hides).toBeTrue();
    expect(impact.message).toContain('único bloque publicado');
  });

  it('se limita al bloque cuando quedan otros publicados', () => {
    const impact = describeBlockImpact(
      {
        block: block(),
        lesson: lesson(),
        module: module(),
        siblingBlocks: [block(), block({ id: 101 })],
      },
      false,
    )!;

    expect(impact.message).not.toContain('único bloque publicado');
    expect(impact.message).toContain('seguirá visible');
  });
});

describe('ejercicios', () => {
  const exercise = (over: Partial<Exercise> = {}): Exercise => ({
    id: 500,
    lesson_id: 10,
    name: 'Crear una lista',
    statement: '...',
    difficulty: 'media',
    starter_html: '',
    starter_css: '',
    starter_js: '',
    solution_html: '',
    solution_css: '',
    solution_js: '',
    criteria: [{ type: 'element_exists', selector: 'li', description: 'Hay lista' }],
    source: 'manual',
    is_published: true,
    order: 1,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  });

  const scope = (over: Partial<ExerciseScope> = {}): ExerciseScope => ({
    exercise: exercise(),
    lesson: lesson(),
    module: module(),
    siblingExercises: [exercise()],
    ...over,
  });

  describe('exercisePublicationBlock', () => {
    it('impide publicar sin criterios', () => {
      // Es el caso grave: `recompute_lesson_progress` cuenta el ejercicio entre los que hay que
      // aprobar, y sin criterios nunca se aprueba, así que el subtema no se completa jamás.
      expect(exercisePublicationBlock({ criteria: [] })).toContain('criterios');
    });

    it('deja publicar en cuanto hay uno', () => {
      expect(exercisePublicationBlock({ criteria: exercise().criteria })).toBeNull();
    });
  });

  describe('resolveExerciseStatus', () => {
    it('es visible con criterios y sus ancestros publicados', () => {
      expect(resolveExerciseStatus(scope()).state).toBe('published');
    });

    it('queda en borrador mientras no se publique', () => {
      const status = resolveExerciseStatus(scope({ exercise: exercise({ is_published: false }) }));
      expect(status.state).toBe('draft');
    });

    it('avisa cuando su subtema o su tema están en borrador', () => {
      expect(resolveExerciseStatus(scope({ lesson: lesson({ is_published: false }) })).reason).toBe(
        'Su subtema está en borrador',
      );
      expect(resolveExerciseStatus(scope({ module: module({ is_published: false }) })).reason).toBe(
        'Su tema está en borrador',
      );
    });

    it('marca como no visible el publicado sin criterios que venga de fuera de la aplicación', () => {
      const roto = resolveExerciseStatus(scope({ exercise: exercise({ criteria: [] }) }));
      expect(roto.reason).toContain('nadie puede aprobarlo');
    });
  });

  describe('describeExerciseImpact', () => {
    it('al publicar habla de obligatoriedad, no de contenido oculto', () => {
      const borrador = scope({ exercise: exercise({ is_published: false }) });
      const impact = describeExerciseImpact(borrador, true)!;

      expect(impact.hides).toBeFalse();
      expect(impact.message).toContain('obligatorio');
      expect(impact.message).toContain('conservan su progreso');
    });

    it('avisa de que el subtema pasará a completarse solo con abrirlo', () => {
      // Es la regla de `mark_lesson_viewed` cuando no queda ningún ejercicio publicado.
      const impact = describeExerciseImpact(scope(), false)!;

      expect(impact.hides).toBeTrue();
      expect(impact.message).toContain('con solo abrirlo');
    });

    it('cuenta los que siguen siendo obligatorios si quedan otros', () => {
      const conOtro = scope({
        siblingExercises: [exercise(), exercise({ id: 501 }), exercise({ id: 502 })],
      });
      const impact = describeExerciseImpact(conOtro, false)!;

      expect(impact.message).toContain('Quedan 2 ejercicios');
    });
  });
});
