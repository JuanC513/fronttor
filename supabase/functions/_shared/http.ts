import { corsHeaders } from './cors.ts';
import { AuthError } from './auth.ts';
import { GeminiError } from './gemini-client.ts';

/** Respuesta JSON con los encabezados CORS ya aplicados. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Traduce las excepciones conocidas al código HTTP que les corresponde.
 * Compartido por las tres funciones para que el contrato de error sea idéntico.
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return jsonResponse({ error: err.message }, err.status);
  }

  if (err instanceof GeminiError) {
    return jsonResponse({ error: err.message, detail: err.detail }, 502);
  }

  return jsonResponse({ error: 'Solicitud inválida', detail: String(err) }, 400);
}
