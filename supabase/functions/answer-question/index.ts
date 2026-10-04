import { AiLogIds, callGeminiLogged } from '../_shared/ai-log.ts';
import { requireUser } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { GEMINI_MODEL } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { formatStudentContext, loadStudentContext } from '../_shared/student-context.ts';
import { buildCodeQuestionPrompt } from '../_shared/prompts/code-question-prompt.ts';
import {
  buildQuestionPrompt,
  ChatTurn,
  QuestionPromptInput,
} from '../_shared/prompts/question-prompt.ts';

/** Una duda sobre el código del taller de práctica libre. */
interface CodeQuestionBody {
  modo: 'codigo';
  pregunta: string;
  codigo?: { html?: string; css?: string; js?: string };
  consola?: string[];
  historial?: ChatTurn[];
}

/**
 * Lo que acepta la función.
 *
 * `modo` es **opcional y por defecto `'leccion'`**: el frontend y las funciones no se despliegan a
 * la vez, y una pestaña abierta sigue ejecutando el bundle anterior, que no manda el campo. Sin ese
 * default, esa pestaña se rompería durante la ventana entre un despliegue y el otro.
 */
type AnswerQuestionBody = AiLogIds &
  (({ modo?: 'leccion' } & QuestionPromptInput) | CodeQuestionBody);

/**
 * Cada modo arma su propio prompt, y esa separación es deliberada.
 *
 * El de lección declara su contenido material curricular confiable; el del taller declara que no
 * hay ninguna fuente confiable, porque el código lo escribió el estudiante. Meter los dos casos en
 * un solo prompt con un condicional invertiría esa etiqueta según un campo del cuerpo, que es
 * exactamente el tipo de error que no avisa cuando ocurre.
 */
function buildPrompt(body: AnswerQuestionBody, estudiante: string): string {
  if (body.modo === 'codigo') {
    return buildCodeQuestionPrompt({
      estudiante,
      pregunta: body.pregunta,
      html: body.codigo?.html ?? '',
      css: body.codigo?.css ?? '',
      js: body.codigo?.js ?? '',
      consola: body.consola,
      historial: body.historial,
    });
  }

  return buildQuestionPrompt({ ...body, estudiante });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 1: cualquier usuario con sesión (estudiante o profesor) puede preguntar.
    const user = await requireUser(req);

    const body: AnswerQuestionBody = await req.json();

    if (!body.pregunta) {
      return jsonResponse({ error: 'Falta la pregunta' }, 400);
    }

    // Quien pregunta importa: el perfil que escribio y por donde va el curso. Si no se puede
    // cargar, el prompt sale sin esos bloques y la respuesta llega igual.
    const estudiante = formatStudentContext(await loadStudentContext(user.client));

    const prompt = buildPrompt(body, estudiante);

    // Preguntar por el código propio sigue siendo preguntar: el check de `kind` en
    // `ai_interactions` no necesita un valor nuevo, y así las dos formas de duda se cuentan juntas.
    // `lessonId` solo llega en el modo lección; en el taller no hay subtema al que apuntar.
    const respuesta = await callGeminiLogged(
      {
        client: user.client,
        userId: user.id,
        kind: 'question',
        model: GEMINI_MODEL,
        lessonId: body.lessonId,
      },
      prompt,
    );

    return jsonResponse({ respuesta });
  } catch (err) {
    return errorResponse(err);
  }
});
