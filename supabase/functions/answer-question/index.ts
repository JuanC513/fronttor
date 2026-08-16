import { corsHeaders } from '../_shared/cors.ts';
import { callGemini, GeminiError } from '../_shared/gemini-client.ts';
import { buildQuestionPrompt, QuestionPromptInput } from '../_shared/prompts/question-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: QuestionPromptInput = await req.json();

    if (!body.pregunta) {
      return new Response(JSON.stringify({ error: 'Falta la pregunta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const respuesta = await callGemini(buildQuestionPrompt(body));

    return new Response(JSON.stringify({ respuesta }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof GeminiError) {
      return new Response(JSON.stringify({ error: err.message, detail: err.detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Solicitud inválida', detail: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
