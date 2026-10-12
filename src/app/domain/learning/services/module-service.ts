import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Module } from '../models/module-model';
import { ModuleWithLessonCounts } from '../models/module-with-lesson-counts';
import { ModuleWithLessons } from '../models/module-with-lessons';

/**
 * Acceso a los temas.
 *
 * Sigue el patrón común de los servicios de dominio: las lecturas van por `select` directo y las
 * escrituras por RPC de Postgres. No es una preferencia de estilo — una RPC corre como una sola
 * transacción del lado del servidor, que es lo que permite reordenar sin dejar el `order` a medias
 * si algo falla a mitad.
 */
@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);

  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;

  /** Columna por la que se ordena. Tipada contra `Module` para que un renombrado no pase. */
  private readonly orderColumn: keyof Module = 'order';

  /**
   * Se incrementa tras cada escritura.
   *
   * Es el aviso de «algo cambió» para quien esté mostrando esta lista. Se eligió una señal en vez
   * de eventos para que un componente pueda leerla reactivamente sin tener que suscribirse ni
   * acordarse de cancelar.
   */
  readonly refreshTrigger = signal(0);

  /** Avisa a los consumidores de que la tabla cambió. */
  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /** Todos los temas, publicados o no, en su orden. Es la lista del panel del profesor. */
  async getAll(): Promise<Module[]> {
    const { data, error } = await this.supabase
      .from('modules')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Module[]) ?? [];
  }

  /** Los temas con sus subtemas embebidos, ambos ordenados. Lo usa el arbol del profesor. */
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

  /** Un tema por su id. Lanza si no existe. */
  async getById(id: number): Promise<Module> {
    const { data, error } = await this.supabase.from('modules').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Module;
  }

  /** Crea un tema al final de la lista. */
  async insert(name: string, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('insert_module', {
      p_name: name,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Renombra un tema o cambia su publicacion. */
  async update(id: number, name: string, isPublished: boolean): Promise<void> {
    const { error } = await this.supabase.rpc('update_module', {
      p_id: id,
      p_name: name,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Borra un tema.
   *
   * Arrastra en cascada sus subtemas, sus bloques y sus ejercicios, y con los ejercicios se van
   * los intentos de los estudiantes. No es reversible.
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_module', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Reescribe el `order` de todos los temas según la posición en `ids`.
   *
   * Va en una sola RPC y no en una actualización por fila: a medias dejaría dos temas con el
   * mismo `order`, y el recorrido del estudiante depende de que ese orden sea total.
   */
  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_modules', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
