import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Exercise, ExerciseInput } from '../models/exercise-model';
import { ExerciseWithLesson } from '../models/exercise-with-lesson';

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  private readonly orderColumn: keyof Exercise = 'order';
  readonly refreshTrigger = signal(0);

  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  async getAll(): Promise<Exercise[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Exercise[]) ?? [];
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
      .select('*, lessons(id, name, is_published, module_id, modules(id, name, is_published))')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as ExerciseWithLesson[]) ?? [];
  }

  async getAllByLessonId(lessonId: number): Promise<Exercise[]> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('lesson_id', lessonId)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Exercise[]) ?? [];
  }

  async getById(id: number): Promise<Exercise> {
    const { data, error } = await this.supabase.from('exercises').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Exercise;
  }

  async insert(input: ExerciseInput): Promise<void> {
    const { error } = await this.supabase.rpc('insert_exercise', this.toRpcParams(input));

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async update(id: number, input: ExerciseInput): Promise<void> {
    const { error } = await this.supabase.rpc('update_exercise', {
      p_id: id,
      ...this.toRpcParams(input),
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

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
