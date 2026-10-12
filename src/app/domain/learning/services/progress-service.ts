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
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;
  /** Se incrementa tras cada escritura, para que las vistas releaan el progreso. */
  readonly refreshTrigger = signal(0);

  /** Avisa de que el progreso cambió. */
  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * El progreso de un estudiante.
   *
   * **El filtro por usuario no es redundante con la RLS.** `lesson_progress` tiene DOS policies de
   * lectura, `progress_select_own` y `progress_select_teacher`, así que una cuenta con los dos roles
   * —como la que se usa para probar— recibe por la RLS el progreso de todo el mundo. Las vistas del
   * estudiante metían esas filas en un `Map` por `lesson_id`, donde gana la última, y acababan
   * pintando el avance de otra persona: un subtema completado aparecía «en progreso» y el candado del
   * recorrido se abría o se cerraba según lo que hubieran hecho otros.
   *
   * Antes esto se llamaba `getMyProgress()` y no recibía nada. Ese nombre era justo lo que hacía
   * invisible el problema, porque el «my» daba por hecho que el servidor ya había elegido. Ahora se
   * pide explícito, como en {@link ExerciseService.getPublishedForStudent}, que tropezó con lo mismo.
   */
  async getForStudent(userId: string): Promise<LessonProgress[]> {
    const { data, error } = await this.supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return (data as LessonProgress[]) ?? [];
  }

  /**
   * Si el estudiante puede abrir ese subtema, según la base.
   *
   * La regla también vive en `learning-progress.ts`, y eso no es duplicación accidental: la del
   * cliente pinta el candado con los datos que ya tiene, y la de la base es la que de verdad manda,
   * porque una URL escrita a mano no pasa por ninguna vista. Esto solo trae la segunda, para que el
   * guard de la ruta no tenga que cargarse el árbol entero del curso.
   *
   * La RPC devuelve `null` cuando el subtema no es parte del recorrido —sin publicar, o sin bloques
   * publicados—, y eso también es un no: no hay nada que abrir.
   */
  async isLessonReachable(lessonId: number): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('lesson_is_reachable', {
      p_lesson_id: lessonId,
    });

    if (error) throw new Error(error.message);
    return data === true;
  }

  /**
   * Deja constancia de que el estudiante abrió un subtema.
   *
   * Es lo que hace avanzar el recorrido: sin esta llamada la tabla de progreso se queda vacía y
   * nada se desbloquea nunca. Además dispara el recálculo del completado, así que un subtema sin
   * ejercicios publicados queda completado con solo abrirlo.
   *
   * Desde `20260929120000` la RPC comprueba el recorrido antes de escribir: sobre un subtema que no
   * es parte del recorrido sale en silencio, y sobre uno que todavía no toca **falla**. Ese fallo no
   * debería ocurrirle nunca a un estudiante que llega por la interfaz.
   */
  async markLessonViewed(lessonId: number): Promise<void> {
    const { error } = await this.supabase.rpc('mark_lesson_viewed', { p_lesson_id: lessonId });

    if (error) throw new Error(error.message);
    this.notifyRefresh();
  }
}
