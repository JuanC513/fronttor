import { AiLogIds, callGeminiLogged } from '../_shared/ai-log.ts';
import { requireTeacher } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { GEMINI_MODEL_CONTENIDO } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { buildContentPrompt, ContentPromptInput } from '../_shared/prompts/content-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 2: generar contenido del curso queda restringido a profesores.
    const user = await requireTeacher(req);

    // Los ids no entran en el prompt: viajan aparte para que la fila del registro sepa a que
    // subtema pertenece lo que se genero.
    const body: ContentPromptInput & AiLogIds = await req.json();

    if (!body.tema || !body.subtema || !body.nombreBloque) {
      return jsonResponse({ error: 'Faltan el tema, el subtema o el nombre del bloque' }, 400);
    }

    const prompt = buildContentPrompt(body);

    const contenido = await callGeminiLogged(
      {
        client: user.client,
        userId: user.id,
        kind: 'content',
        model: GEMINI_MODEL_CONTENIDO,
        lessonId: body.lessonId,
      },
      prompt,
    );

    return jsonResponse({ contenido });
  } catch (err) {
    return errorResponse(err);
  }
});
