import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Lesson } from '../models/lesson-model';

@Injectable({
  providedIn: 'root',
})
export class LessonService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;

  async getById(id: number): Promise<Lesson> {
    const { data, error } = await this.supabase.from('lessons').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Lesson;
  }

  async insert(name: string, moduleId: number, order: number): Promise<void> {
    const { error } = await this.supabase.rpc('insert_lesson', {
      p_name: name,
      p_module_id: moduleId,
      p_order: order,
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_lesson', { p_id: id });

    if (error) throw new Error(error.message);
  }

  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_lessons', { p_ids: ids });

    if (error) throw new Error(error.message);
  }
}
