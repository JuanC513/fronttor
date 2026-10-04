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
    // El tier gratuito de Gemini limita las peticiones por minuto, y el chat del estudiante
    // es mucho más intensivo. Sin este caso, quien
    // agota la cuota ve un 502 con el volcado crudo del error de Google.
    if (err.status === 429) {
      return jsonResponse(
        {
          error: 'Hay muchas preguntas en este momento. Espera unos segundos e inténtalo de nuevo.',
        },
        429,
      );
    }

    // Gemini responde 503 cuando el modelo está saturado, y pasa con cierta frecuencia en los
    // modelos gratuitos. Sin este caso, un fallo pasajero se ve igual que uno de configuración y
    // nadie sabe que basta con reintentar.
    if (err.status === 503) {
      return jsonResponse(
        {
          error:
            'El modelo está saturado en este momento. Es pasajero: vuelve a intentarlo en un minuto.',
        },
        503,
      );
    }

    return jsonResponse({ error: err.message, detail: err.detail }, 502);
  }

  return jsonResponse({ error: 'Solicitud inválida', detail: String(err) }, 400);
}
