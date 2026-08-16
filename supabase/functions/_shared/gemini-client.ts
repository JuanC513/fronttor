// gemini-3.5-flash-lite es uso actual para prompts de alta frecuencia
// (feedback, resolución de dudas). Cuando se agregue generate-content/generate-exercise,
// considerar un modelo de mayor calidad para esos prompts de baja frecuencia.
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
  }
}

/** Único punto de llamada a la API de Gemini — Compartido por todas las funciones */
export async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new GeminiError('GEMINI_API_KEY no configurada', '');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!response.ok) {
    throw new GeminiError('Error al llamar a Gemini', await response.text());
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
