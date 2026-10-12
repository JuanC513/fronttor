import { inject, Injectable, signal } from '@angular/core';
import { Block } from '../models/block-model';
import { SupabaseService } from '@core/services/supabase/supabase-service';

/**
 * Acceso a los bloques de contenido.
 *
 * Distingue entre leer para el profesor —todo, borradores incluidos— y leer para el estudiante,
 * que solo ve lo publicado. Esa diferencia no es cosmética: un subtema sin bloques publicados deja
 * de ser alcanzable, y con él los intentos de sus ejercicios dejan de guardarse.
 */
@Injectable({
  providedIn: 'root',
})
export class BlockService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;
  /** Columna por la que se ordena. Tipada contra `Block` para que un renombrado no pase. */
  private readonly orderColumn: keyof Block = 'order';
  /**
   * Se incrementa tras cada escritura.
   *
   * Es el aviso de «algo cambió» para quien esté mostrando esta lista, sin obligarle a
   * suscribirse ni a acordarse de cancelar.
   */
  readonly refreshTrigger = signal(0);

  /** Avisa a los consumidores de que `blocks` cambió. */
  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * Todos los bloques del curso, ordenados.
   *
   * El `order` no es decorativo: quien llama filtra por subtema en el cliente y numera por la
   * POSICIÓN en el array. Sin ordenar, PostgREST devuelve las filas en el orden físico de la tabla
   * —que cambia cada vez que se actualiza una—, así que editar un bloque lo movía de sitio en la
   * lista aunque su columna `order` siguiera igual.
   */
  async getAll(): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  /** Los bloques de un subtema, borradores incluidos. Vista de profesor. */
  async getAllByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  /**
   * Los bloques que el estudiante puede leer de un subtema.
   *
   * Es un método aparte de {@link getAllByLessonId} y no un parámetro booleano a propósito: la
   * separación entre la lectura del profesor y la del estudiante ya es el patrón del repo
   * (`getAllWithLessons` frente a `getLearningTree`), y así el propósito se lee en la llamada.
   */
  async getPublishedByLessonId(lessonId: number): Promise<Block[]> {
    const { data, error } = await this.supabase
      .from('blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('is_published', true)
      .order(this.orderColumn, { ascending: true });

    if (error) throw new Error(error.message);
    return (data as Block[]) ?? [];
  }

  /** Un bloque por su id. Lanza si no existe. */
  async getById(id: number): Promise<Block> {
    const { data, error } = await this.supabase.from('blocks').select('*').eq('id', id).single();

    if (error) throw new Error(error.message);
    return data as Block;
  }

  /** Crea un bloque al final de su subtema. */
  async insert(
    name: string,
    content: string,
    lessonId: number,
    isPublished: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('insert_block', {
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Reescribe el nombre, el contenido o la publicación de un bloque. */
  async update(
    id: number,
    name: string,
    content: string,
    lessonId: number,
    isPublished: boolean,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('update_block', {
      p_id: id,
      p_name: name,
      p_content: content,
      p_lesson_id: lessonId,
      p_is_published: isPublished,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /**
   * Borra un bloque.
   *
   * Si era el único publicado de su subtema, el subtema deja de verse para el estudiante.
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase.rpc('delete_block', { p_id: id });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }

  /** Reescribe el `order` de los bloques en una sola RPC. */
  async reorderAll(ids: number[]): Promise<void> {
    const { error } = await this.supabase.rpc('reorder_blocks', { p_ids: ids });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
