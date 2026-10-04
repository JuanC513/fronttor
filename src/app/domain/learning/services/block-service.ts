import { inject, Injectable, signal } from '@angular/core';
import { Block } from '../models/block-model';
import { SupabaseService } from '@core/services/supabase/supabase-service';

@Injectable({
  providedIn: 'root',
})
export class BlockService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  private readonly orderColumn: keyof Block = 'order';
  readonly refreshTrigger = signal(0);

  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * Todos los bloques del curso, ordenados.
   *
   * El `order` no es decorativo: quien llama filtra por subtema en el cliente y numera por la
   * POSICIÓN en el array. Sin ordenar, PostgREST devuelve las filas en el orden físico de la tabla
   * —que cambia cada vez que se actualiza una—, así que editar un bloque lo movía de sitio en la
   * lista aunque su columna `order` siguiera igual.
   */
  async getAll(): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  async getAllByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  /**
   * Los bloques que el estudiante puede leer de un subtema.
   *
   * Es un método aparte de {@link getAllByLessonId} y no un parámetro booleano a propósito: la
   * separación entre la lectura del profesor y la del estudiante ya es el patrón del repo
   * (`getAllWithLessons` frente a `getLearningTree`), y así el propósito se lee en la llamada.
   */
  async getPublishedByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('is_published', true)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  async getById(id: number): Promise<Block> {
    const { data, error } = await this.supabase.from('blocks').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Block;
  }

  async insert(
    name: string,
    content: string,
    lessonId: number,
    isPublished: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('insert_block', {
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async update(
    id: number,
    name: string,
    content: string,
    lessonId: number,
    isPublished: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('update_block', {
      p_id: id,
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_block', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_blocks', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
