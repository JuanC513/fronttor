import { logInteraction } from '../_shared/ai-log.ts';
import { requireTeacher } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini, GEMINI_MODEL_CONTENIDO } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import {
  buildExercisePrompt,
  ExercisePart,
  ExercisePromptInput,
  generationConfigFor,
} from '../_shared/prompts/exercise-prompt.ts';

const PARTES: ExercisePart[] = ['statement', 'starter', 'solution', 'criteria'];

/**
 * Genera una parte de un ejercicio: enunciado, codigo inicial, solucion o criterios.
 *
 * Una sola funcion con la parte como discriminador, y no cuatro: comparten el control de acceso,
 * el manejo de errores y el despliegue. Ademas, el boton de "generar el ejercicio completo" que
 * vendra despues son cuatro llamadas encadenadas a esta misma, no un prompt aparte.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 2: generar contenido del curso queda restringido a profesores.
    const user = await requireTeacher(req);

    const body: ExercisePromptInput = await req.json();

    if (!PARTES.includes(body.parte)) {
      return jsonResponse({ error: 'Parte del ejercicio no reconocida' }, 400);
    }

    if (!body.tema || !body.subtema || !body.nombre) {
      return jsonResponse({ error: 'Faltan el tema, el subtema o el nombre del ejercicio' }, 400);
    }

    const prompt = buildExercisePrompt(body);
    const texto = await callGemini(prompt, GEMINI_MODEL_CONTENIDO, generationConfigFor(body.parte));

    await logInteraction(user.client, {
      userId: user.id,
      kind: 'exercise',
      model: GEMINI_MODEL_CONTENIDO,
      prompt,
      response: texto,
    });

    // El enunciado es markdown y va tal cual; el resto viene como JSON por `responseSchema`.
    if (body.parte === 'statement') {
      return jsonResponse({ enunciado: texto });
    }

    try {
      return jsonResponse({ resultado: JSON.parse(texto) });
    } catch {
      // Con `responseMimeType` no deberia pasar, pero un JSON roto que llegara al cliente
      // reventaria mas adelante y con un mensaje mucho peor de entender.
      return jsonResponse({ error: 'El modelo devolvio una respuesta con formato invalido' }, 502);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
