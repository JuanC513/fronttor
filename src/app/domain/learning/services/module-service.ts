import { inject, Injectable, signal } from '@angular/core';
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
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as ModuleWithLessons[]) ?? [];
  }

  async getById(id: number): Promise<Module> {
    const { data, error } = await this.supabase.from('modules').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Module;
  }

  async insert(name: string): Promise<void> {
    const { error } = await this.supabase.rpc('insert_module', { p_name: name });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  async update(id: number, name: string): Promise<void> {
    const { error } = await this.supabase.rpc('update_module', { p_id: id, p_name: name });

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
