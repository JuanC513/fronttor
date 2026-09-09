import { Block } from '../models/block-model';
import { Exercise } from '../models/exercise-model';
import { Lesson } from '../models/lesson-model';
import { Module } from '../models/module-model';

/**
 * Derivación de la visibilidad del contenido del curso.
 *
 * `is_published` es lo que el administrador **declara**. Que algo se **vea** es una consecuencia
 * que se calcula:
 *
 * ```
 * bloque visible  <=> bloque.is_published
 * subtema visible <=> subtema.is_published AND tiene >=1 bloque visible
 * tema visible    <=> tema.is_published    AND tiene >=1 subtema visible
 * ```
 *
 * Un subtema depende de sus **bloques** y no de sus ejercicios: un subtema que solo tuviera
 * ejercicios no tendría nada que enseñar. Es la misma regla que ya aplicaba `visibleModules` en la
 * vista de estudiante antes de que existiera `is_published`.
 *
 * Todo aquí son funciones puras: es la única parte con reglas de negocio de verdad y la consumen
 * tanto las listas del panel de administración como los avisos de los formularios, que tienen que
 * decir exactamente lo mismo.
 */

/**
 * - `published`: declarado publicado y visible para el estudiante.
 * - `hidden`: declarado publicado pero no se muestra. Es un aviso legítimo, no ruido: el
 *   administrador dijo que quería publicarlo y no está pasando.
 * - `draft`: declarado no publicado. Estado deliberado, no avisa de nada.
 */
export type PublicationState = 'published' | 'hidden' | 'draft';

export interface PublicationStatus {
  state: PublicationState;
  /** Por qué no se muestra. Solo viene con `hidden`. */
  reason?: string;
}

export interface ToggleImpact {
  severity: 'info' | 'warn';
  message: string;
  /** El cambio oculta algo que hoy sí se ve; es el único caso que merece confirmación al guardar. */
  hides: boolean;
}

/** Un tema con sus subtemas. `blocks` puede ser la lista completa: se filtra por `lesson_id`. */
export interface ModuleScope {
  module: Module;
  lessons: Lesson[];
  blocks: Block[];
}

/** `siblingLessons` incluye al propio subtema; `blocks` puede ser la lista completa. */
export interface LessonScope {
  lesson: Lesson;
  module: Module;
  siblingLessons: Lesson[];
  blocks: Block[];
}

/** `siblingBlocks` incluye al propio bloque. */
export interface BlockScope {
  block: Block;
  lesson: Lesson;
  module: Module;
  siblingBlocks: Block[];
}

const PUBLISHED: PublicationStatus = { state: 'published' };
const DRAFT: PublicationStatus = { state: 'draft' };

const hidden = (reason: string): PublicationStatus => ({ state: 'hidden', reason });

const count = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`;

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function resolveBlockStatus({ block, lesson, module }: BlockScope): PublicationStatus {
  if (!block.is_published) return DRAFT;

  // El ancestro se comprueba antes que nada: mientras esté en borrador, nada de lo que haya
  // debajo se muestra, hagas lo que hagas aquí.
  if (!module.is_published) return hidden('Su tema está en borrador');
  if (!lesson.is_published) return hidden('Su subtema está en borrador');

  // No hace falta comprobar que el subtema tenga bloques publicados: este lo es.
  return PUBLISHED;
}

export function resolveLessonStatus(scope: LessonScope): PublicationStatus {
  const { lesson, module, blocks } = scope;

  if (!lesson.is_published) return DRAFT;
  if (!module.is_published) return hidden('Su tema está en borrador');

  const own = blocks.filter((block) => block.lesson_id === lesson.id);
  if (own.length === 0) return hidden('No tiene bloques');
  if (!own.some((block) => block.is_published)) {
    return hidden('Ninguno de sus bloques está publicado');
  }

  return PUBLISHED;
}

export function resolveModuleStatus(scope: ModuleScope): PublicationStatus {
  const { module, lessons, blocks } = scope;

  if (!module.is_published) return DRAFT;
  if (lessons.length === 0) return hidden('No tiene subtemas');

  const published = lessons.filter((lesson) => lesson.is_published);
  if (published.length === 0) return hidden('Ninguno de sus subtemas está publicado');

  const visible = published.filter((lesson) =>
    isVisible(resolveLessonStatus({ lesson, module, siblingLessons: lessons, blocks })),
  );
  if (visible.length === 0) {
    return hidden('Sus subtemas publicados no tienen bloques publicados');
  }

  return PUBLISHED;
}

export const isVisible = (status: PublicationStatus): boolean => status.state === 'published';

// ---------------------------------------------------------------------------
// Consecuencias de publicar o despublicar
//
// Devuelven `null` cuando el interruptor no se ha movido. En cualquier otro caso siempre hay algo
// que decir: incluso "esto no cambia nada para los estudiantes" es información, y su ausencia haría
// parecer que la interfaz no reaccionó.
// ---------------------------------------------------------------------------

export function describeModuleImpact(scope: ModuleScope, next: boolean): ToggleImpact | null {
  const { module, lessons, blocks } = scope;
  if (next === module.is_published) return null;

  const before = resolveModuleStatus(scope);
  const after = resolveModuleStatus({ ...scope, module: { ...module, is_published: next } });

  if (next) return revealed(after);

  if (!isVisible(before)) return unchanged();

  const visible = lessons.filter((lesson) =>
    isVisible(resolveLessonStatus({ lesson, module, siblingLessons: lessons, blocks })),
  ).length;

  return {
    severity: 'warn',
    hides: true,
    message:
      `Dejarán de verse ${count(visible, 'subtema', 'subtemas')} y todo su contenido. ` +
      'No se pierde nada: al volver a publicar el tema, cada subtema y cada bloque recuperan ' +
      'el estado que tuvieran.',
  };
}

export function describeLessonImpact(scope: LessonScope, next: boolean): ToggleImpact | null {
  const { lesson, module, siblingLessons, blocks } = scope;
  if (next === lesson.is_published) return null;

  const before = resolveLessonStatus(scope);
  const after = resolveLessonStatus({ ...scope, lesson: { ...lesson, is_published: next } });

  if (next) return revealed(after);

  if (!isVisible(before)) return unchanged();

  const published = blocks.filter(
    (block) => block.lesson_id === lesson.id && block.is_published,
  ).length;

  // Si era el único subtema visible del tema, el tema entero desaparece con él. Es la misma
  // sorpresa que el "único bloque", un nivel más arriba.
  const otherVisible = siblingLessons.filter(
    (other) =>
      other.id !== lesson.id &&
      isVisible(resolveLessonStatus({ lesson: other, module, siblingLessons, blocks })),
  ).length;

  const cascade =
    otherVisible === 0
      ? ` Además, «${module.name}» dejará de mostrarse: este era su único subtema visible.`
      : '';

  return {
    severity: 'warn',
    hides: true,
    message: `Dejarán de verse ${count(published, 'bloque', 'bloques')}.${cascade}`,
  };
}

export function describeBlockImpact(scope: BlockScope, next: boolean): ToggleImpact | null {
  const { block, lesson, siblingBlocks } = scope;
  if (next === block.is_published) return null;

  const after = resolveBlockStatus({ ...scope, block: { ...block, is_published: next } });

  if (next) return revealed(after);

  if (!isVisible(resolveBlockStatus(scope))) return unchanged();

  // Un subtema sin bloques publicados deja de existir para el estudiante. Que despublicar un
  // bloque pueda tumbar el subtema entero no se ve venir desde este formulario.
  const others = siblingBlocks.filter(
    (other) => other.id !== block.id && other.is_published,
  ).length;

  if (others === 0) {
    return {
      severity: 'warn',
      hides: true,
      message:
        `Es el único bloque publicado de «${lesson.name}». Al despublicarlo, el subtema ` +
        'entero dejará de mostrarse a los estudiantes.',
    };
  }

  return {
    severity: 'warn',
    hides: true,
    message: `Dejará de verse. «${lesson.name}» seguirá visible con sus otros ${others} bloques.`,
  };
}

/** Publicar algo que aun así no se verá es el caso que más desconcierta; se dice el motivo. */
function revealed(after: PublicationStatus): ToggleImpact {
  if (after.state === 'hidden') {
    return {
      severity: 'warn',
      hides: false,
      message: `Seguirá sin mostrarse a los estudiantes: ${after.reason!.toLowerCase()}.`,
    };
  }

  return {
    severity: 'info',
    hides: false,
    message: 'Pasará a mostrarse a los estudiantes.',
  };
}

function unchanged(): ToggleImpact {
  return {
    severity: 'info',
    hides: false,
    message: 'No se estaba mostrando, así que nada cambia para los estudiantes.',
  };
}

// ---------------------------------------------------------------------------
// Ejercicios
//
// Se tratan aparte porque no participan en la visibilidad del subtema: eso solo lo deciden los
// bloques. Lo que un ejercicio publicado cambia es otra cosa —pasa a ser obligatorio para
// completar el subtema— y por eso sus avisos hablan de progreso y no de contenido oculto.
//
// Para los ancestros basta con mirar `is_published`, sin arrastrar los bloques hasta aquí. Que un
// subtema publicado no se vea por no tener bloques publicados es un problema del subtema, y su
// propia insignia ya lo dice.
// ---------------------------------------------------------------------------

/** `siblingExercises` incluye al propio ejercicio. */
export interface ExerciseScope {
  exercise: Exercise;
  lesson: Lesson;
  module: Module;
  siblingExercises: Exercise[];
}

/**
 * Por qué no se puede publicar este ejercicio, o `null` si sí se puede.
 *
 * Un ejercicio publicado sin criterios no es solo inútil: `recompute_lesson_progress` lo cuenta
 * entre los que hay que aprobar, y como no hay nada que comprobar nunca se aprueba. El subtema
 * queda imposible de completar para todo el mundo, sin que nada lo explique. Por eso el bloqueo
 * está en la interfaz y no en un aviso que se pueda ignorar.
 */
export function exercisePublicationBlock(exercise: Pick<Exercise, 'criteria'>): string | null {
  if (exercise.criteria.length > 0) return null;

  return (
    'Todavía no tiene criterios de validación. Sin ellos nadie puede aprobarlo, y el subtema ' +
    'quedaría imposible de completar.'
  );
}

export function resolveExerciseStatus({
  exercise,
  lesson,
  module,
}: ExerciseScope): PublicationStatus {
  if (!exercise.is_published) return DRAFT;

  if (!module.is_published) return hidden('Su tema está en borrador');
  if (!lesson.is_published) return hidden('Su subtema está en borrador');

  // No deberia darse, porque el formulario impide publicarlo: queda por si la fila se creo fuera
  // de la aplicacion.
  if (exercise.criteria.length === 0) return hidden('No tiene criterios y nadie puede aprobarlo');

  return PUBLISHED;
}

export function describeExerciseImpact(scope: ExerciseScope, next: boolean): ToggleImpact | null {
  const { exercise, siblingExercises } = scope;
  if (next === exercise.is_published) return null;

  const after = resolveExerciseStatus({ ...scope, exercise: { ...exercise, is_published: next } });

  if (next) {
    if (after.state === 'hidden') return revealed(after);

    return {
      severity: 'info',
      hides: false,
      message:
        'Pasará a ser obligatorio: los estudiantes tendrán que resolverlo para completar el ' +
        'subtema. Quienes ya lo completaron conservan su progreso.',
    };
  }

  if (!isVisible(resolveExerciseStatus(scope))) return unchanged();

  const others = siblingExercises.filter(
    (other) => other.id !== exercise.id && other.is_published,
  ).length;

  // Sin ejercicios publicados, el subtema se completa con solo abrirlo. Es la regla de
  // `mark_lesson_viewed`, y conviene decirla antes de que ocurra.
  const consequence =
    others === 0
      ? ' Era el único publicado, así que el subtema pasará a completarse con solo abrirlo.'
      : ` Quedan ${others} ejercicios obligatorios en el subtema.`;

  return {
    severity: 'warn',
    hides: true,
    message: `Dejará de mostrarse y de ser obligatorio.${consequence}`,
  };
}
