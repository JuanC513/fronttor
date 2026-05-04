import { inject, Injectable } from '@angular/core';
import { Block } from '../models/block-model';
import { SupabaseService } from '@core/services/supabase/supabase-service';

@Injectable({
  providedIn: 'root',
})
export class BlockService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  private readonly orderColumn: keyof Block = 'order';

  async getAllByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  async getById(id: number): Promise<Block> {
    const { data, error } = await this.supabase.from('blocks').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Block;
  }

  async insert(name: string, content: string, lessonId: number, order: number): Promise<void> {
    const { error } = await this.supabase.rpc('insert_block', {
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
      p_order: order,
    });

    if (error) throw new Error(error.message);
  }

  async reorder(id: number, newOrder: number): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_block', { p_id: id, p_new_order: newOrder });

    if (error) throw new Error(error.message);
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_block', { p_id: id });

    if (error) throw new Error(error.message);
  }
}
