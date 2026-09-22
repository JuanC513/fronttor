import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { LessonProgress } from '../models/lesson-progress-model';

/**
 * El avance del estudiante por el recorrido.
 *
 * La escritura no pasa por aquí de forma directa: `lesson_progress` no concede insert ni update a
 * nadie, y la única vía son RPC `security definer` que resuelven el usuario con `auth.uid()` del
 * lado del servidor. Eso es lo que impide que alguien se marque un subtema como completado.
 */
@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  readonly refreshTrigger = signal(0);

  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * El progreso del usuario en sesión.
   *
   * No lleva filtro por usuario porque la RLS ya lo pone: `progress_select_own` solo deja ver las
   * filas propias. Ojo con la excepción, que importa en las cuentas con doble rol: un profesor
   * puede ver el progreso de todos por `progress_select_teacher`, así que si algún día esto se usa
   * desde una vista del profesor habrá que filtrar a mano.
   */
  async getMyProgress(): Promise<LessonProgress[]> {
    const { data, error } = await this.supabase.from('lesson_progress').select('*');

    if (error) throw new Error(error.message);
    return (data as LessonProgress[]) ?? [];
  }

  /**
   * Deja constancia de que el estudiante abrió un subtema.
   *
   * Es lo que hace avanzar el recorrido: sin esta llamada la tabla de progreso se queda vacía y
   * nada se desbloquea nunca. Además dispara el recálculo del completado, así que un subtema sin
   * ejercicios publicados queda completado con solo abrirlo.
   *
   * Sobre un subtema no publicado la RPC sale en silencio, sin escribir ni fallar.
   */
  async markLessonViewed(lessonId: number): Promise<void> {
    const { error } = await this.supabase.rpc('mark_lesson_viewed', { p_lesson_id: lessonId });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
