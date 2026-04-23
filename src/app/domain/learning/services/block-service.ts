import { inject, Injectable } from '@angular/core';
import { Block } from '../models/block-model';
import { SupabaseService } from '@core/services/supabase/supabase-service';

@Injectable({
  providedIn: 'root',
})
export class BlockService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;

  async getAllByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('id, name, content, lesson_id')
      .eq('lesson_id', lessonId)
      .order('id', { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }
}
