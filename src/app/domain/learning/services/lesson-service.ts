import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Lesson } from '../models/lesson-model';

/**
 * Acceso a los subtemas.
 *
 * Mismo patrón que {@link ModuleService}: lecturas por `select`, escrituras por RPC.
 */
@Injectable({
  providedIn: 'root',
})
export class LessonService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;
  /** Columna por la que se ordena. Tipada contra `Lesson` para que un renombrado no pase. */
  private readonly orderColumn: keyof Lesson = 'order';
  /**
   * Se incrementa tras cada escritura.
   *
   * Es el aviso de «algo cambió» para quien esté mostrando esta lista, sin obligarle a
   * suscribirse ni a acordarse de cancelar.
   */
  readonly refreshTrigger = signal(0);

  /** Avisa a los consumidores de que `lessons` cambió. */
  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /** Ordenado por el mismo motivo que {@link BlockService.getAll}: sin `order by` el orden de las
   * filas depende de su posición física, que cambia al actualizar cualquiera de ellas. */
  async getAll(): Promise<Lesson[]> {
    const { data, error } = await this.supabase
      .from('lessons')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Lesson[]) ?? [];
  }

  /** Un subtema por su id. Lanza si no existe. */
  async getById(id: number): Promise<Lesson> {
    const { data, error } = await this.supabase.from('lessons').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Lesson;
  }

  /** Crea un subtema al final de su tema. */
  async insert(name: string, moduleId: number, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('insert_lesson', {
      p_name: name,
      p_module_id: moduleId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Renombra el subtema, lo mueve de tema o cambia su publicación. */
  async update(id: number, name: string, moduleId: number, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('update_lesson', {
      p_id: id,
      p_name: name,
      p_module_id: moduleId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Borra un subtema.
   *
   * Arrastra en cascada sus bloques y sus ejercicios, y con los ejercicios los intentos de los
   * estudiantes. No es reversible.
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_lesson', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Reescribe el `order` de los subtemas en una sola RPC, para no dejarlo a medias. */
  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_lessons', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
