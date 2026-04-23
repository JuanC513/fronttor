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
    const { data, error } = await this.supabase
      .from('lessons')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Lesson;
  }
}
