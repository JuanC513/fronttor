import { requireUser } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { buildFeedbackPrompt, FeedbackPromptInput } from '../_shared/prompts/feedback-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 1: cualquier usuario con sesión (estudiante o profesor) puede pedir retroalimentación.
    await requireUser(req);

    const body: FeedbackPromptInput = await req.json();

    if (!body.enunciado) {
      return jsonResponse({ error: 'Falta el enunciado del ejercicio' }, 400);
    }

    const feedback = await callGemini(buildFeedbackPrompt(body));

    return jsonResponse({ feedback });
  } catch (err) {
    return errorResponse(err);
  }
});
