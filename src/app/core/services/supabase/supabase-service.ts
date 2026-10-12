import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

/**
 * El cliente de Supabase, creado una sola vez para toda la aplicación.
 *
 * Existe como servicio y no como un `createClient` suelto para que haya **una única instancia**:
 * dos clientes sobre el mismo proyecto compiten por el bloqueo del token de sesión y acaban
 * dando `NavigatorLockAcquireTimeoutError`.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  /** La instancia única. Se expone solo de lectura a través de {@link SupabaseService.client}. */
  private supabase: SupabaseClient;

  /** Crea el cliente con el flujo de autenticación que corresponde a una SPA. */
  constructor() {
    //`pkce` es el flujo correcto para una SPA (no expone tokens en la URL)
    // `detectSessionInUrl` hace que el cliente procese solo el `?code=` del retorno de OAuth,
    // así la página de callback únicamente tiene que esperar a que la sesión exista.
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  /** El cliente, para que los servicios de dominio hagan sus consultas. */
  get client(): SupabaseClient {
    return this.supabase;
  }
}
