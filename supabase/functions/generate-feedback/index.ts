import { corsHeaders } from '../_shared/cors.ts';
import { callGemini, GeminiError } from '../_shared/gemini-client.ts';
import { buildFeedbackPrompt, FeedbackPromptInput } from '../_shared/prompts/feedback-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: FeedbackPromptInput = await req.json();

    if (!body.enunciado) {
      return new Response(JSON.stringify({ error: 'Falta el enunciado del ejercicio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const feedback = await callGemini(buildFeedbackPrompt(body));

    return new Response(JSON.stringify({ feedback }), {
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
