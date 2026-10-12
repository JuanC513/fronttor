import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Exercise, ExerciseInput, ExerciseWithoutSolution } from '../models/exercise-model';
import { ExerciseWithLesson } from '../models/exercise-with-lesson';
import { StudentExercise } from '../models/student-exercise';
import { StudentExerciseDetail } from '../models/student-exercise-detail';

/**
 * Las columnas que la API entrega a cualquier usuario con sesion.
 *
 * Esta lista es el espejo del `grant select (...)` de
 * 20260926120000_hide_exercise_solution.sql. Las tres columnas de solucion quedan fuera, y pedirlas
 * por aqui no devuelve la solucion: devuelve un error de permisos.
 *
 * Por eso ya no se usa `select('*')` en ninguna lectura del panel. Con el grant por columnas, el
 * comodin se expande a columnas que el rol no tiene y la consulta entera falla.
 */
const COLUMNAS_SIN_SOLUCION =
  'id, lesson_id, name, statement, difficulty, starter_html, starter_css, starter_js, criteria, source, is_published, "order", created_at';

/**
 * Acceso a los ejercicios.
 *
 * Es el servicio con más variantes de lectura, y el motivo es la solución de referencia: hay un
 * camino para el profesor que la trae (vía RPC) y varios para el estudiante que no la piden
 * siquiera, porque desde `20260926120000_hide_exercise_solution.sql` la API ya no se la entrega.
 */
@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;
  /** Columna por la que se ordena. Tipada contra `Exercise` para que un renombrado no pase. */
  private readonly orderColumn: keyof Exercise = 'order';
  /**
   * Se incrementa tras cada escritura.
   *
   * Es el aviso de «algo cambió» para quien esté mostrando esta lista, sin obligarle a
   * suscribirse ni a acordarse de cancelar.
   */
  readonly refreshTrigger = signal(0);

  /** Avisa a los consumidores de que `exercises` cambió. */
  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * Todos los ejercicios con su subtema y su tema, para el listado del profesor.
   *
   * El orden es por posición dentro del subtema, así que solo tiene sentido leído por subtema: en
   * una lista mezclada de varios se ven varios «1». Es también el motivo de que reordenar exija
   * filtrar por uno.
   */
  async getAllWithLesson(): Promise<ExerciseWithLesson[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select(
        `${COLUMNAS_SIN_SOLUCION}, lessons(id, name, is_published, module_id, modules(id, name, is_published))`,
      )
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as unknown as ExerciseWithLesson[]) ?? [];
  }

  /** Los ejercicios de un subtema, sin la solución de referencia. */
  async getAllByLessonId(lessonId: number): Promise<ExerciseWithoutSolution[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select(COLUMNAS_SIN_SOLUCION)
      .eq('lesson_id', lessonId)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as unknown as ExerciseWithoutSolution[]) ?? [];
  }

  /**
   * Los ejercicios que el estudiante puede ver, con si ya los tiene aprobados.
   *
   * Método aparte y no un parámetro, igual que {@link BlockService.getPublishedByLessonId}: la
   * separación entre la lectura del profesor y la del estudiante es el patrón del repo, y así el
   * propósito se lee en la llamada. Ninguno de los otros métodos de este servicio filtra por
   * publicación, porque todos son del panel.
   *
   * **El filtro por `user_id` no sobra.** La RLS de `exercise_attempts` tiene DOS políticas de
   * lectura: `attempts_select_own` y `attempts_select_teacher`. Una cuenta con los dos roles
   * —como la que se usa para probar— vería por el embed los intentos de todos los estudiantes, y
   * cualquier ejercicio aprobado por alguien aparecería como aprobado por ella. La RLS no basta
   * aquí; hay que acotarlo en la consulta.
   *
   * El embed se recorta a los intentos aprobados, así que el array llega vacío o no llega: lo que
   * importa es su existencia, no su contenido.
   */
  async getPublishedForStudent(userId: string): Promise<StudentExercise[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('id, lesson_id, name, difficulty, order, exercise_attempts(passed)')
      .eq('is_published', true)
      .eq('exercise_attempts.user_id', userId)
      .eq('exercise_attempts.passed', true)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);

    return (
      (data as (Omit<StudentExercise, 'passed'> & { exercise_attempts: unknown[] })[]) ?? []
    ).map(({ exercise_attempts, ...exercise }) => ({
      ...exercise,
      passed: (exercise_attempts ?? []).length > 0,
    }));
  }

  /**
   * El ejercicio que el estudiante va a resolver, sin la solución de referencia.
   *
   * **La solución no llega hasta aquí ni aunque se pidiera.** Desde
   * 20260926120000_hide_exercise_solution.sql, `authenticated` no tiene SELECT sobre
   * `solution_html`, `solution_css` ni `solution_js`: la frontera está en la base, no en esta
   * lista de columnas.
   *
   * La lista sigue enumerada de todos modos, y no sobra. Con el grant por columnas, un `select('*')`
   * falla entero con «permission denied for column», así que escribir las columnas es lo que hace
   * que la consulta funcione. Antes era además la única defensa; ahora es la segunda.
   *
   * El filtro por publicación evita además que un borrador se pueda abrir por URL.
   *
   * El embed de intentos va acotado por `user_id` por el mismo motivo que en
   * {@link getPublishedForStudent}: una cuenta con los dos roles vería por la RLS los intentos de
   * todo el mundo, y el ejercicio aparecería resuelto porque lo resolvió otro.
   */
  async getForStudent(id: number, userId: string): Promise<StudentExerciseDetail> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select(
        'id, lesson_id, name, statement, difficulty, starter_html, starter_css, starter_js, criteria, exercise_attempts(passed)',
      )
      .eq('id', id)
      .eq('is_published', true)
      .eq('exercise_attempts.user_id', userId)
      .eq('exercise_attempts.passed', true)
      .single();

    if (error) throw new Error(error.message);

    const { exercise_attempts, ...exercise } = data as Omit<StudentExerciseDetail, 'passed'> & {
      exercise_attempts: unknown[];
    };

    return { ...exercise, passed: (exercise_attempts ?? []).length > 0 };
  }

  /**
   * El ejercicio entero, con su solucion de referencia, para el formulario del profesor.
   *
   * Es el UNICO camino que queda hacia `solution_html`, `solution_css` y `solution_js`: desde
   * 20260926120000, `authenticated` no tiene SELECT sobre esas columnas, asi que leerlas por la
   * tabla falla para todo el mundo, profesores incluidos. La RPC es `security definer` y comprueba
   * `is_teacher()` por dentro.
   *
   * Sin rol de profesor no devuelve filas -no lanza-, asi que desde fuera es indistinguible de un
   * ejercicio que no existe. De ahi que el error sea el mismo en los dos casos.
   */
  async getById(id: number): Promise<Exercise> {
    const { data, error } = await this.supabase
      .rpc('get_exercise_for_edit', { p_id: id })
      .single<Exercise>();

    if (error) throw new Error(error.message);
    return data;
  }

  /** Crea un ejercicio al final de su subtema. */
  async insert(input: ExerciseInput): Promise<void> {
    const { error } = await this.supabase.rpc('insert_exercise', this.toRpcParams(input));

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Reescribe un ejercicio.
   *
   * Cambiar `criteria` invalida los intentos anteriores para `fallosPorTipo`, porque
   * `get_student_context` descarta aquellos cuyo número de resultados ya no cuadra.
   */
  async update(id: number, input: ExerciseInput): Promise<void> {
    const { error } = await this.supabase.rpc('update_exercise', {
      p_id: id,
      ...this.toRpcParams(input),
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Borra un ejercicio.
   *
   * Arrastra en cascada los intentos de los estudiantes. Durante una recogida de datos esto
   * destruye evidencia.
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_exercise', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Los ids deben ser los de un mismo subtema: la posición es única dentro de él. */
  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_exercises', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Las dos RPC comparten todos los parámetros salvo el id, que solo lleva la de actualizar. */
  private toRpcParams(input: ExerciseInput) {
    return {
      p_lesson_id: input.lesson_id,
      p_name: input.name,
      p_statement: input.statement,
      p_difficulty: input.difficulty,
      p_starter_html: input.starter_html,
      p_starter_css: input.starter_css,
      p_starter_js: input.starter_js,
      p_solution_html: input.solution_html,
      p_solution_css: input.solution_css,
      p_solution_js: input.solution_js,
      p_criteria: input.criteria,
      p_source: input.source,
      p_is_published: input.is_published,
    };
  }
}
