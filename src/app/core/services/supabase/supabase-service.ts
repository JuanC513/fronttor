import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

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

  get client(): SupabaseClient {
    return this.supabase;
  }
}
