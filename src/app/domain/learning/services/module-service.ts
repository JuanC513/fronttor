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
  private readonly orderColumn: keyof Module = 'order';

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
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as ModuleWithLessons[]) ?? [];
  }

  async getById(id: number): Promise<Module> {
    const { data, error } = await this.supabase.from('modules').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Module;
  }

  async insert(name: string, order: number): Promise<void> {
    const { error } = await this.supabase.rpc('insert_module', { p_name: name, p_order: order });

    if (error) throw new Error(error.message);
  }

  async reorder(id: number, newOrder: number): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_module', {
      p_id: id,
      p_new_order: newOrder,
    });

    if (error) throw new Error(error.message);
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_module', { p_id: id });

    if (error) throw new Error(error.message);
  }
}
