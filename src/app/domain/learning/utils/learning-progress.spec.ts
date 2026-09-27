import { LessonProgress } from '../models/lesson-progress-model';
import { ModuleWithLessonCounts } from '../models/module-with-lesson-counts';

import {
  exerciseStatus,
  lessonAvailability,
  lessonExerciseProgress,
  orderedLessons,
} from './learning-progress';

describe('learning-progress', () => {
  const buildModule = (id: number, lessonIds: number[], blocks = 1): ModuleWithLessonCounts => ({
    id,
    name: `Tema ${id}`,
    order: id,
    is_published: true,
    lessons: lessonIds.map((lessonId) => ({
      id: lessonId,
      name: `Subtema ${lessonId}`,
      order: lessonId,
      module_id: id,
      is_published: true,
      blocks: [{ count: blocks }],
    })),
  });

  const progressRow = (lessonId: number, status: 'in_progress' | 'completed'): LessonProgress => ({
    id: lessonId,
    user_id: 'usuario-1',
    lesson_id: lessonId,
    status,
    exercises_at_completion: status === 'completed' ? 2 : null,
    completed_at: status === 'completed' ? '2026-01-01T00:00:00Z' : null,
    updated_at: '2026-01-01T00:00:00Z',
  });

  describe('orderedLessons', () => {
    it('aplana los subtemas de todos los temas conservando el orden', () => {
      const lessons = orderedLessons([buildModule(1, [10, 11]), buildModule(2, [20])]);

      expect(lessons.map((item) => item.lesson.id)).toEqual([10, 11, 20]);
      expect(lessons.map((item) => item.moduleId)).toEqual([1, 1, 2]);
    });

    it('descarta los subtemas sin bloques y los temas que se quedan vacíos', () => {
      const conBloques = buildModule(1, [10]);
      const sinBloques = buildModule(2, [20], 0);

      expect(orderedLessons([conBloques, sinBloques]).map((item) => item.lesson.id)).toEqual([10]);
    });

    /**
     * Importa para el encadenado: si un subtema vacío ocupara sitio en la secuencia, el siguiente
     * quedaría esperando a que se complete algo que nadie puede abrir.
     */
    it('lo descartado no ocupa posición en la secuencia', () => {
      const lessons = orderedLessons([
        buildModule(1, [10]),
        buildModule(2, [20], 0),
        buildModule(3, [30]),
      ]);

      expect(lessons.map((item) => item.lesson.id)).toEqual([10, 30]);
    });
  });

  describe('lessonAvailability', () => {
    const lessons = orderedLessons([buildModule(1, [10, 11, 12])]);

    it('el primer subtema está disponible por los dos caminos sin haber hecho nada', () => {
      const availability = lessonAvailability(lessons, []);

      expect(availability.get(10)).toEqual({
        content: true,
        exercises: true,
        completed: false,
        visited: false,
      });
    });

    it('sin progreso, todo lo que no sea el primero está cerrado', () => {
      const availability = lessonAvailability(lessons, []);

      expect(availability.get(11)?.content).toBeFalse();
      expect(availability.get(11)?.exercises).toBeFalse();
    });

    it('abrir un subtema desbloquea el CONTENIDO del siguiente, pero no sus ejercicios', () => {
      const availability = lessonAvailability(lessons, [progressRow(10, 'in_progress')]);

      expect(availability.get(11)?.content).toBeTrue();
      expect(availability.get(11)?.exercises).toBeFalse();
    });

    it('completarlo desbloquea también los ejercicios del siguiente', () => {
      const availability = lessonAvailability(lessons, [progressRow(10, 'completed')]);

      expect(availability.get(11)?.content).toBeTrue();
      expect(availability.get(11)?.exercises).toBeTrue();
    });

    it('el desbloqueo no salta subtemas', () => {
      // Completar el primero no alcanza al tercero mientras el segundo siga sin abrirse.
      const availability = lessonAvailability(lessons, [progressRow(10, 'completed')]);

      expect(availability.get(12)?.content).toBeFalse();
      expect(availability.get(12)?.exercises).toBeFalse();
    });

    /**
     * El invariante que sostiene el modo mixto: completar exige haber abierto, así que no puede
     * existir un subtema con ejercicios disponibles y contenido cerrado. Si esto falla, el
     * estudiante podría practicar algo que no se le deja leer.
     */
    it('nunca hay ejercicios disponibles sin contenido disponible', () => {
      const combinaciones: LessonProgress[][] = [
        [],
        [progressRow(10, 'in_progress')],
        [progressRow(10, 'completed')],
        [progressRow(10, 'completed'), progressRow(11, 'in_progress')],
        [progressRow(10, 'completed'), progressRow(11, 'completed')],
      ];

      for (const progress of combinaciones) {
        for (const estado of lessonAvailability(lessons, progress).values()) {
          if (estado.exercises) expect(estado.content).toBeTrue();
        }
      }
    });

    it('distingue abierto de completado en el propio subtema', () => {
      const availability = lessonAvailability(lessons, [progressRow(10, 'in_progress')]);

      expect(availability.get(10)?.visited).toBeTrue();
      expect(availability.get(10)?.completed).toBeFalse();
    });
  });

  /**
   * La puerta entre temas, que es más dura que el encadenado de dentro: pasar de tema exige el tema
   * anterior COMPLETO, no solo haber abierto su último subtema.
   */
  describe('lessonAvailability entre temas', () => {
    const lessons = orderedLessons([buildModule(1, [10, 11]), buildModule(2, [20, 21])]);

    it('completar el tema entero abre el siguiente por los dos caminos', () => {
      const availability = lessonAvailability(lessons, [
        progressRow(10, 'completed'),
        progressRow(11, 'completed'),
      ]);

      expect(availability.get(20)?.content).toBeTrue();
      expect(availability.get(20)?.exercises).toBeTrue();
    });

    it('abrir el último subtema del tema anterior no abre el tema siguiente', () => {
      const availability = lessonAvailability(lessons, [
        progressRow(10, 'completed'),
        progressRow(11, 'in_progress'),
      ]);

      expect(availability.get(20)?.content).toBeFalse();
      expect(availability.get(20)?.exercises).toBeFalse();
    });

    /**
     * El caso que la regla vieja dejaba pasar: mira el subtema ANTERIOR y no el tema. Con el último
     * completado y uno de en medio a medias, abría el tema siguiente igualmente.
     */
    it('no basta con que el último esté completado si queda otro sin completar', () => {
      const availability = lessonAvailability(lessons, [
        progressRow(10, 'in_progress'),
        progressRow(11, 'completed'),
      ]);

      expect(availability.get(20)?.content).toBeFalse();
    });

    it('dentro del tema recién abierto se vuelve a encadenar por haber abierto', () => {
      const availability = lessonAvailability(lessons, [
        progressRow(10, 'completed'),
        progressRow(11, 'completed'),
        progressRow(20, 'in_progress'),
      ]);

      expect(availability.get(21)?.content).toBeTrue();
      expect(availability.get(21)?.exercises).toBeFalse();
    });

    /** El mismo invariante del modo mixto, pero cruzando la frontera de tema. */
    it('nunca hay ejercicios disponibles sin contenido disponible', () => {
      const combinaciones: LessonProgress[][] = [
        [],
        [progressRow(10, 'in_progress')],
        [progressRow(10, 'completed')],
        [progressRow(10, 'in_progress'), progressRow(11, 'completed')],
        [progressRow(10, 'completed'), progressRow(11, 'in_progress')],
        [progressRow(10, 'completed'), progressRow(11, 'completed')],
        [
          progressRow(10, 'completed'),
          progressRow(11, 'completed'),
          progressRow(20, 'in_progress'),
        ],
      ];

      for (const progress of combinaciones) {
        for (const estado of lessonAvailability(lessons, progress).values()) {
          if (estado.exercises) expect(estado.content).toBeTrue();
        }
      }
    });
  });

  describe('exerciseStatus', () => {
    const disponible = { exercises: true, completed: false };
    const cerrado = { exercises: false, completed: false };
    const completado = { exercises: true, completed: true };

    it('aprobado manda sobre todo lo demás', () => {
      expect(exerciseStatus(true, cerrado)).toBe('passed');
      expect(exerciseStatus(true, completado)).toBe('passed');
    });

    it('pendiente cuando el subtema tiene los ejercicios abiertos', () => {
      expect(exerciseStatus(false, disponible)).toBe('pending');
    });

    it('bloqueado cuando el subtema todavía no los abre', () => {
      expect(exerciseStatus(false, cerrado)).toBe('locked');
    });

    /**
     * Un subtema completado tenía TODOS sus ejercicios aprobados; uno que siga sin aprobar solo
     * puede haber llegado después. De ahí sale el «Nuevo», sin mirar ninguna fecha.
     */
    it('sin aprobar dentro de un subtema completado solo puede ser nuevo', () => {
      expect(exerciseStatus(false, completado)).toBe('new');
    });
  });

  describe('lessonExerciseProgress', () => {
    it('cuenta los aprobados sobre el total', () => {
      expect(lessonExerciseProgress(['passed', 'passed', 'pending'])).toEqual({
        passed: 2,
        total: 3,
        percent: 67,
      });
    });

    it('un subtema sin ejercicios cuenta como completo', () => {
      // Es lo que hace `recompute_lesson_progress`: sin ejercicios publicados, abrirlo lo completa.
      expect(lessonExerciseProgress([])).toEqual({ passed: 0, total: 0, percent: 100 });
    });

    it('los nuevos cuentan en el total, así que la barra baja al añadirlos', () => {
      expect(lessonExerciseProgress(['passed', 'passed', 'new']).percent).toBe(67);
    });
  });
});
