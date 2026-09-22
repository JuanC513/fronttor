// gemini-3.5-flash-lite es uso actual para prompts de alta frecuencia
// (feedback, resolución de dudas), donde importan la latencia y el límite de tasa.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Modelo para prompts de baja frecuencia y alta exigencia de calidad, como redactar el
 * contenido markdown de un bloque. Son pocas llamadas así que compensa
 * gastar más por respuesta a cambio de mejor redacción.
 */
export const GEMINI_MODEL_CONTENIDO = 'gemini-3.6-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly detail: string,
    /** Código HTTP que devolvió Gemini. `0` cuando el fallo es previo a la petición. */
    readonly status = 0,
  ) {
    super(message);
  }
}

/**
 * Ajustes de generacion de Gemini.
 *
 * Se usa para pedir salida estructurada: cuando la respuesta no es prosa sino datos con forma
 * fija —los tres archivos de codigo de un ejercicio, o su lista de criterios—, `responseSchema`
 * evita tener que analizar texto libre y confiar en que venga bien.
 */
export interface GeminiGenerationConfig {
  responseMimeType?: string;
  responseSchema?: unknown;
}

/** Único punto de llamada a la API de Gemini — Compartido por todas las funciones */
export async function callGemini(
  prompt: string,
  model: string = GEMINI_MODEL,
  generationConfig?: GeminiGenerationConfig,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new GeminiError('GEMINI_API_KEY no configurada', '');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(generationConfig ? { generationConfig } : {}),
    }),
  });

  if (!response.ok) {
    throw new GeminiError('Error al llamar a Gemini', await response.text(), response.status);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
