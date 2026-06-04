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

  async getAll(): Promise<Block[]> {
    const { data, error } = await this.supabase.from('blocks').select('*');

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

  async getById(id: number): Promise<Block> {
    const { data, error } = await this.supabase.from('blocks').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Block;
  }

  async insert(name: string, content: string, lessonId: number): Promise<void> {
    const { error } = await this.supabase.rpc('insert_block', {
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async update(id: number, name: string, lessonId: number): Promise<void> {
    const { error } = await this.supabase.rpc('update_block', {
      p_id: id,
      p_name: name,
      p_lesson_id: lessonId,
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
