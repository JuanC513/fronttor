import { requireUser } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { buildQuestionPrompt, QuestionPromptInput } from '../_shared/prompts/question-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 1: cualquier usuario con sesión (estudiante o profesor) puede preguntar.
    await requireUser(req);

    const body: QuestionPromptInput = await req.json();

    if (!body.pregunta) {
      return jsonResponse({ error: 'Falta la pregunta' }, 400);
    }

    const respuesta = await callGemini(buildQuestionPrompt(body));

    return jsonResponse({ respuesta });
  } catch (err) {
    return errorResponse(err);
  }
});
