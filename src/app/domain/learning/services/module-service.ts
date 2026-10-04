import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Module } from '../models/module-model';
import { ModuleWithLessonCounts } from '../models/module-with-lesson-counts';
import { ModuleWithLessons } from '../models/module-with-lessons';

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  private readonly orderColumn: keyof Module = 'order';
  readonly refreshTrigger = signal(0);

  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  async getAll(): Promise<Module[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Module[]) ?? [];
  }

  async getAllWithLessons(): Promise<ModuleWithLessons[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select(`*, lessons(*)`)
      .order(this.orderColumn, { ascending: true })
      .order(this.orderColumn, { ascending: true, referencedTable: 'lessons' });

    if (error) throw new Error(error.message);
    return (data as ModuleWithLessons[]) ?? [];
  }

  /**
   * Árbol de contenido para la vista de estudiante: los mismos temas y subtemas que
   * {@link getAllWithLessons}, más el conteo de bloques de cada subtema para poder descartar lo que
   * todavía no es consumible.
   *
   * Solo devuelve lo publicado, y el filtro va en la consulta y no en el componente para que el
   * contenido en preparación ni siquiera llegue al navegador.
   *
   * Ojo con el comportamiento de PostgREST: filtrar un recurso embebido vacía su array pero
   * conserva la fila padre. Un tema sin subtemas publicados vuelve con `lessons: []`, y de
   * descartarlo se encarga la vista, que ya lo hacía antes de que existiera `is_published`.
   */
  async getLearningTree(): Promise<ModuleWithLessonCounts[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select(`*, lessons(*, blocks(count))`)
      .eq('is_published', true)
      .eq('lessons.is_published', true)
      .eq('lessons.blocks.is_published', true)
      .order(this.orderColumn, { ascending: true })
      .order(this.orderColumn, { ascending: true, referencedTable: 'lessons' });

    if (error) throw new Error(error.message);
    return (data as ModuleWithLessonCounts[]) ?? [];
  }

  async getById(id: number): Promise<Module> {
    const { data, error } = await this.supabase.from('modules').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Module;
  }

  async insert(name: string, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('insert_module', {
      p_name: name,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async update(id: number, name: string, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('update_module', {
      p_id: id,
      p_name: name,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_module', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_modules', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
