import { AiLogIds, callGeminiLogged } from '../_shared/ai-log.ts';
import { requireUser } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { GEMINI_MODEL_CONTENIDO } from '../_shared/gemini-client.ts';
import { errorResponse, jsonResponse } from '../_shared/http.ts';
import { CRITERIA_SCHEMA } from '../_shared/prompts/exercise-prompt.ts';
import {
  buildPracticeCriteriaPrompt,
  buildPracticePrompt,
  PRACTICE_SCHEMA,
  PracticeCriteriaPromptInput,
  PracticePromptInput,
} from '../_shared/prompts/practice-prompt.ts';

type PracticeBody = AiLogIds &
  (
    | ({ modo?: 'completo' } & PracticePromptInput)
    | ({ modo: 'criterios' } & PracticeCriteriaPromptInput)
  );

/**
 * Genera un ejercicio de práctica para el propio estudiante.
 *
 * ## Por qué es una función aparte y no un modo de `generate-exercise`
 *
 * Aquella es `requireTeacher` y tiene que seguir siéndolo: produce material del curso, que se
 * guarda, se publica y cuenta para el progreso de todos. Relajarla con un parámetro pondría a un
 * estudiante a generar currículo. Esta es `requireUser`, como `answer-question`, y lo que devuelve
 * no toca la base: vive en la memoria de una pestaña y se pierde al salir.
 *
 * ## Dos modos
 *
 * - `completo`: el ejercicio entero en una sola respuesta.
 * - `criterios`: solo la lista de criterios, para cuando la comprobación del cliente encontró
 *   alguno mal planteado. Es lo que evita entregarle al estudiante un ejercicio que no puede
 *   aprobar —el profesor arregla eso a mano, y él no tiene con qué—.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Capa 1: cualquier usuario con sesión. Practicar no es generar contenido del curso.
    const user = await requireUser(req);

    const body: PracticeBody = await req.json();

    if (!body.tema || !body.subtema || !body.dificultad) {
      return jsonResponse({ error: 'Faltan el tema, el subtema o la dificultad' }, 400);
    }

    // El `if` va sobre `body.modo` y no sobre un booleano aparte para que TypeScript estreche el
    // tipo: `diagnostico` solo existe en la rama de reparación.
    let prompt: string;
    let responseSchema: unknown;

    if (body.modo === 'criterios') {
      if (!body.diagnostico?.length) {
        return jsonResponse({ error: 'Falta el diagnóstico de los criterios' }, 400);
      }

      prompt = buildPracticeCriteriaPrompt(body);
      responseSchema = CRITERIA_SCHEMA;
    } else {
      prompt = buildPracticePrompt(body);
      responseSchema = PRACTICE_SCHEMA;
    }

    // Mismo `kind` que la generación del profesor: sigue siendo un ejercicio hecho por el modelo, y
    // separarlos obligaría a tocar el check de la columna para contar lo mismo en dos cubos. El
    // `lessonId` es el subtema que el estudiante eligió en el desplegable.
    const texto = await callGeminiLogged(
      {
        client: user.client,
        userId: user.id,
        kind: 'exercise',
        model: GEMINI_MODEL_CONTENIDO,
        lessonId: body.lessonId,
      },
      prompt,
      { responseMimeType: 'application/json', responseSchema },
    );

    try {
      return jsonResponse({ resultado: JSON.parse(texto) });
    } catch {
      // Con `responseMimeType` no debería pasar, pero un JSON roto que llegara al cliente
      // reventaría más adelante y con un mensaje mucho peor de entender.
      return jsonResponse({ error: 'El modelo devolvió una respuesta con formato inválido' }, 502);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
