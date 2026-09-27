import { AiLogIds, callGeminiLogged } from '../_shared/ai-log.ts';
import { requireUser } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { GEMINI_MODEL } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { formatStudentContext, loadStudentContext } from '../_shared/student-context.ts';
import {
  buildFeedbackPrompt,
  feedbackGenerationConfig,
  FeedbackPromptInput,
} from '../_shared/prompts/feedback-prompt.ts';

/** El cuerpo lleva además el ejercicio, que no entra en el prompt pero sí en el registro. */
interface FeedbackRequest extends FeedbackPromptInput, AiLogIds {}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 1: cualquier usuario con sesión (estudiante o profesor) puede pedir retroalimentación.
    const user = await requireUser(req);

    const body: FeedbackRequest = await req.json();

    if (!body.enunciado) {
      return jsonResponse({ error: 'Falta el enunciado del ejercicio' }, 400);
    }

    if (!Array.isArray(body.criterios)) {
      return jsonResponse({ error: 'Faltan los criterios del ejercicio' }, 400);
    }

    // Saber que lleva seis intentos en este mismo ejercicio es lo que separa una pista util de
    // una que trata cada envio como si fuera el primero.
    const estudiante = formatStudentContext(await loadStudentContext(user.client));

    const prompt = buildFeedbackPrompt({ ...body, estudiante });
    const texto = await callGeminiLogged(
      {
        client: user.client,
        userId: user.id,
        kind: 'feedback',
        model: GEMINI_MODEL,
        lessonId: body.lessonId,
        exerciseId: body.exerciseId,
      },
      prompt,
      feedbackGenerationConfig,
    );

    // `callGemini` devuelve '' cuando la respuesta se corta por límite de tokens o la bloquea un
    // filtro de seguridad —y la entrada aquí es código escrito por un estudiante, así que pasa—.
    // `JSON.parse('')` lanza, de modo que sin este try el fallo saldría como un 400 genérico.
    let feedback: unknown;
    try {
      feedback = JSON.parse(texto);
    } catch {
      return jsonResponse({ error: 'El modelo devolvio una respuesta con formato invalido' }, 502);
    }

    return jsonResponse({ feedback });
  } catch (err) {
    return errorResponse(err);
  }
});
