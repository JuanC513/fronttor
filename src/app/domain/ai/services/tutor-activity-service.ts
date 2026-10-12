import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';

/** La última vez que el estudiante usó el tutor. */
/** La última vez que el estudiante usó el tutor, sea por donde fuera. */
export interface UltimaInteraccion {
  /** Por dónde fue: una duda, una pista sobre un envío o un ejercicio de práctica. */
  tipo: 'question' | 'feedback' | 'practice';

  /** Cuándo, en ISO 8601. */
  cuando: string;
  /** El subtema sobre el que fue, o `null`: una práctica del taller libre no cuelga de ninguno. */
  subtema: string | null;
}

/** Cuánto ha usado el estudiante el tutor, para el panel de Inicio. */
/** Cuánto ha usado el estudiante el tutor, desglosado por vía. */
export interface TutorActivity {
  /** Dudas que le ha hecho al chat. */
  preguntas: number;

  /** Pistas que ha pedido tras enviar un ejercicio. */
  pistas: number;

  /** Ejercicios de práctica que ha generado. */
  practicas: number;

  /** La más reciente de las tres, o `null` si nunca lo ha usado. */
  ultima: UltimaInteraccion | null;
}

/** Lo que se muestra cuando todavía no ha usado el tutor, o cuando la lectura falla. */
export const SIN_ACTIVIDAD: TutorActivity = {
  preguntas: 0,
  pistas: 0,
  practicas: 0,
  ultima: null,
};

/**
 * El uso que el estudiante ha hecho del tutor.
 *
 * Servicio aparte de `AiService` porque es otro camino de acceso: aquel invoca Edge Functions y
 * esto lee una RPC de Postgres. Es la misma separación que justifica que `AttemptService` no viva
 * dentro de `ExerciseService`.
 *
 * **No lee la tabla, y no es por comodidad.** `ai_interactions` guarda el `prompt`, que lleva dentro
 * las reglas del sistema y las defensas contra inyección; dárselas a leer al estudiante es lo que
 * permitiría fabricar una a medida. Por eso `20261001120000` expone solo el agregado, con una
 * función `security definer`, y el estudiante sigue sin poder leer ni una fila.
 */
@Injectable({
  providedIn: 'root',
})
export class TutorActivityService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = this.supabaseService.client;

  /**
   * No lleva `userId`: la RPC resuelve el usuario con `auth.uid()` del lado del servidor, que es lo
   * que impide pedir la actividad de otra persona.
   */
  async getMyActivity(): Promise<TutorActivity> {
    const { data, error } = await this.supabase.rpc('get_my_tutor_activity');

    if (error) throw new Error(error.message);

    return { ...SIN_ACTIVIDAD, ...((data as Partial<TutorActivity> | null) ?? {}) };
  }
}
