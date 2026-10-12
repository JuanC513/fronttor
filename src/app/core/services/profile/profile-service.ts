import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';

/**
 * Lo único que el usuario puede editar de su propio perfil.
 *
 * ## Por qué un `update` directo y no una RPC
 *
 * Es la excepción al patrón del repo —lecturas por `select`, escrituras por RPC— y es deliberada.
 * `20260919120000_tighten_identity_grants.sql` revocó todo sobre `profiles` y volvió a conceder
 * exactamente dos cosas: `select`, y `update` **sobre una sola columna**:
 *
 * ```sql
 * grant update (profile_description) on table public.profiles to authenticated;
 * ```
 *
 * Ese grant existe precisamente para esta escritura, y el límite que impone —por columna— es más
 * fuerte que el que daría una RPC: la RLS opera por fila y no puede impedir que alguien toque un
 * campo concreto; solo los permisos expresan eso. Envolverlo en una función no añadiría ninguna
 * garantía, solo una capa más que mantener.
 *
 * El `eq('user_id', ...)` tampoco sobra, aunque `profiles_update_own` ya acote la fila: sin él, un
 * fallo futuro en esa policy convertiría esta llamada en un update masivo.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  /** Atajo al cliente de Supabase, que es lo que se usa en cada consulta. */
  private readonly supabase = inject(SupabaseService).client;

  /** Guarda la descripción del estudiante. Una cadena vacía se guarda como `null`. */
  async saveDescription(userId: string, description: string): Promise<void> {
    const texto = description.trim();

    const { error } = await this.supabase
      .from('profiles')
      .update({ profile_description: texto || null })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }
}
