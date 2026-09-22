import { requireTeacher } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini, GEMINI_MODEL_CONTENIDO } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { buildContentPrompt, ContentPromptInput } from '../_shared/prompts/content-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 2: generar contenido del curso queda restringido a profesores.
    await requireTeacher(req);

    const body: ContentPromptInput = await req.json();

    if (!body.tema || !body.subtema || !body.nombreBloque) {
      return jsonResponse({ error: 'Faltan el tema, el subtema o el nombre del bloque' }, 400);
    }

    const contenido = await callGemini(buildContentPrompt(body), GEMINI_MODEL_CONTENIDO);

    return jsonResponse({ contenido });
  } catch (err) {
    return errorResponse(err);
  }
});
