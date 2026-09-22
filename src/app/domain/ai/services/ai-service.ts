import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { AnswerQuestionRequest, AnswerQuestionResponse } from '../models/answer-question-model';
import { GenerateContentRequest, GenerateContentResponse } from '../models/generate-content-model';
import {
  GenerateExerciseRequest,
  GenerateExerciseResponse,
} from '../models/generate-exercise-model';

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

  /**
   * @param signal Permite cancelar la petición. La generación tarda varios segundos, así que
   * el llamador debe poder abortarla si el usuario se va (p. ej. al cerrar el diálogo); sin
   * esto la petición seguiría hasta responder, gastando cuota del modelo para nada.
   */
  async generateBlockContent(input: GenerateContentRequest, signal?: AbortSignal): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<GenerateContentResponse>(
      'generate-content',
      { body: input, signal },
    );

    if (error) throw new Error(await this.readFunctionError(error));
    return data?.contenido ?? '';
  }

  /**
   * Genera una parte de un ejercicio: enunciado, código inicial, solución o criterios.
   *
   * Devuelve la respuesta sin interpretar. El enunciado llega como markdown y el resto como datos
   * ya analízados, pero darles forma es cosa de quien llama: el formulario sabe que los criterios
   * se recortan con `toCriterion` y el código se vuelca en sus tres campos.
   *
   * @param signal Igual que en `generateBlockContent`: la generación tarda varios segundos y hay
   * que poder abandonarla si se cierra el diálogo.
   */
  async generateExercisePart(
    input: GenerateExerciseRequest,
    signal?: AbortSignal,
  ): Promise<GenerateExerciseResponse> {
    const { data, error } = await this.supabase.functions.invoke<GenerateExerciseResponse>(
      'generate-exercise',
      { body: input, signal },
    );

    if (error) throw new Error(await this.readFunctionError(error));
    return data ?? {};
  }

  /**
   * Resuelve una duda del estudiante sobre la lección que está viendo.
   *
   * @param signal Igual que en `generateBlockContent`: permite cancelar si el estudiante
   * cierra el chat o sale de la vista mientras el tutor responde.
   */
  async answerQuestion(input: AnswerQuestionRequest, signal?: AbortSignal): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<AnswerQuestionResponse>(
      'answer-question',
      { body: input, signal },
    );

    if (error) throw new Error(await this.readFunctionError(error));
    return data?.respuesta ?? '';
  }

  /**
   * `functions.invoke` no expone el cuerpo de una respuesta no-2xx: su `message` es
   * siempre el genérico "Edge Function returned a non-2xx status code", y el mensaje
   * real de la función viaja dentro de `error.context`, que es un `Response` sin leer.
   * Sin esto, un 403 "Requiere rol de profesor" llegaría a la UI como texto inútil.
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
