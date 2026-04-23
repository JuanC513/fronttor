import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Module } from '../models/module-model';
import { ModuleWithLessons } from '../models/module-with-lessons';

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;

  async getAll(): Promise<Module[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select('id, name')
      .order('id', { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Module[]) ?? [];
  }

  async getAllWithLessons(): Promise<ModuleWithLessons[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select(`id, name, lessons(id, name, module_id)`)
      .order('id', { ascending: true });

    if (error) throw new Error(error.message);
    return (data as ModuleWithLessons[]) ?? [];
  }

  async getById(id: number): Promise<Module> {
    const { data, error } = await this.supabase
      .from('modules')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Module;
  }
}
