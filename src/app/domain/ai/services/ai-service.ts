import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { GenerateContentRequest, GenerateContentResponse } from '../models/generate-content-model';

/**
 * Punto único de acceso a las capacidades de IA, expuestas como Edge Functions.
 *
 * A diferencia de los servicios de dominio que hablan con tablas, este no tiene
 * `refreshTrigger`: son llamadas sin estado, no hay lista que refrescar.
 */
@Injectable({
  providedIn: 'root',
})
export class AiService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;

  async generateBlockContent(input: GenerateContentRequest): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<GenerateContentResponse>(
      'generate-content',
      { body: input },
    );

    if (error) throw new Error(await this.readFunctionError(error));
    return data?.contenido ?? '';
  }

  /**
   * `functions.invoke` no expone el cuerpo de una respuesta no-2xx: su `message` es
   * siempre el genérico "Edge Function returned a non-2xx status code", y el mensaje
   * real de la función viaja dentro de `error.context`, que es un `Response` sin leer.
   * Sin esto, un 403 "Requiere rol de administrador" llegaría a la UI como texto inútil.
   */
  private async readFunctionError(error: Error): Promise<string> {
    const context = (error as Error & { context?: Response }).context;

    if (context instanceof Response) {
      try {
        const body = await context.json();
        if (typeof body?.error === 'string') return body.error;
      } catch {
        // El cuerpo no era JSON; nos quedamos con el mensaje genérico.
      }
    }

    return error.message;
  }
}
