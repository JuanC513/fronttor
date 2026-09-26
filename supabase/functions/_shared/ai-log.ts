import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { callGemini, GeminiError, GeminiGenerationConfig } from './gemini-client.ts';

/** Espejo del check de la columna `kind` en `ai_interactions`. */
export type AiKind = 'question' | 'feedback' | 'content' | 'exercise';

/**
 * Ids que solo sirven para el registro: NO entran en ningun prompt.
 *
 * Viajan en el cuerpo de la peticion junto a los datos del prompt, y cada funcion los separa al
 * construirlo. Sin ellos, la tabla no puede responder "que subtema genera mas dudas", que es la
 * pregunta mas pedagogica que esta tabla sabe contestar.
 */
export interface AiLogIds {
  lessonId?: number;
  exerciseId?: number;
}

export interface AiInteractionLog extends AiLogIds {
  userId: string;
  kind: AiKind;
  model: string;
  prompt: string;
  /** Lo que respondio el modelo. Vacio cuando la llamada fallo. */
  response?: string;
  /** `error` deja la fila sin `response` y con el motivo. */
  status?: 'ok' | 'error';
  /** Codigo HTTP de Gemini cuando se conoce. 429 cuota, 503 saturado. */
  errorStatus?: number | null;
  errorMessage?: string;
}

/** El detalle del fallo puede ser el volcado entero de Google; no hace falta guardarlo completo. */
const MAX_ERROR_LENGTH = 2_000;

/**
 * Deja constancia de una llamada al modelo en `ai_interactions`.
 *
 * La tabla existe desde la primera migracion y hasta ahora no la escribia nadie: es la unica forma
 * de responder despues a "cuanta IA se uso, para que y con que resultado", que en un sistema cuyo
 * argumento es la retroalimentacion personalizada no es un dato accesorio.
 *
 * ## Es un efecto secundario y se comporta como tal
 *
 * Se llama justo despues de que el modelo conteste -o de que falle al hacerlo- y antes de
 * responderle al cliente. Nunca lanza: si el registro falla, el estudiante recibe igual lo que
 * pidio. Lo contrario seria absurdo -perder una respuesta que costo varios segundos de cuota
 * porque no se pudo anotar que ocurrio-.
 *
 * En la practica nadie la llama a mano: todas las llamadas pasan por `callGeminiLogged`, que es
 * quien registra el exito y el fallo sin que haya que acordarse.
 *
 * Se espera en vez de dejarlo suelto porque el isolate puede terminar en cuanto se responde, y un
 * insert a medio camino simplemente no llegaria. Cuesta una ida y vuelta al mismo origen con el que
 * `requireUser` ya hablo, es decir decenas de milisegundos sobre una llamada a Gemini de segundos.
 *
 * ## Dos detalles que parecen de estilo y no lo son
 *
 * 1. **`user_id` va explicito.** La columna es nullable y sin default, y la policy de insercion es
 *    `with check (user_id = auth.uid())`. Omitirlo mete NULL, y `NULL = auth.uid()` evalua a NULL,
 *    asi que la policy DENIEGA. Fallaria siempre y en silencio.
 * 2. **No se encadena `.select()`.** Sin el, supabase-js manda `Prefer: return=minimal` y PostgREST
 *    no hace RETURNING. Con el si lo haria, y ese RETURNING se evalua contra la policy de SELECT,
 *    que para el dueno no existe a proposito: `ai_interactions` solo la lee el profesor. Es decir,
 *    anadir `.select()` "para comprobar que inserto" rompe la insercion.
 */
export async function logInteraction(
  client: SupabaseClient,
  entry: AiInteractionLog,
): Promise<void> {
  try {
    const { error } = await client.from('ai_interactions').insert({
      user_id: entry.userId,
      kind: entry.kind,
      model: entry.model,
      prompt: entry.prompt,
      response: entry.response ?? null,
      lesson_id: entry.lessonId ?? null,
      exercise_id: entry.exerciseId ?? null,
      status: entry.status ?? 'ok',
      error_status: entry.errorStatus ?? null,
      error_message: entry.errorMessage ? entry.errorMessage.slice(0, MAX_ERROR_LENGTH) : null,
    });

    // supabase-js NO rechaza ante un error de base de datos: resuelve con `{ data, error }`. Un
    // 42501 de RLS o un 23503 de clave foranea llegan aqui, no al catch, que solo ve fallos de red.
    if (error) {
      console.error('No se pudo registrar la interaccion con la IA', error);
    }
  } catch (err) {
    console.error('No se pudo registrar la interaccion con la IA', err);
  }
}

/** Lo que hace falta saber de una llamada antes de hacerla. */
export interface AiCallContext extends AiLogIds {
  client: SupabaseClient;
  userId: string;
  kind: AiKind;
  model: string;
}

/**
 * Llama al modelo y deja constancia pase lo que pase.
 *
 * ## Por que existe en vez de repetir el registro en cada funcion
 *
 * Porque ya se demostro que repartir el conocimiento entre las cinco funciones no funciona: las
 * notas del entorno de ejecucion vivieron dentro de un prompt durante meses y los otros cuatro
 * nunca las recibieron. Aqui el riesgo es el mismo con una consecuencia peor: una funcion que se
 * olvide de registrar el fallo no rompe nada, simplemente no cuenta, y el sesgo que esta ronda
 * viene a corregir vuelve por la puerta de atras.
 *
 * Con un solo punto de llamada, registrar deja de ser algo que haya que acordarse de hacer.
 *
 * ## El error se vuelve a lanzar
 *
 * Registrar no es manejar. `errorResponse` sigue siendo quien traduce el fallo a HTTP, y el
 * estudiante sigue viendo el mismo mensaje de siempre. Lo unico que cambia es que ahora queda
 * escrito que ocurrio.
 */
export async function callGeminiLogged(
  context: AiCallContext,
  prompt: string,
  generationConfig?: GeminiGenerationConfig,
): Promise<string> {
  const { client, ...ids } = context;

  try {
    const response = await callGemini(prompt, context.model, generationConfig);

    await logInteraction(client, { ...ids, prompt, response, status: 'ok' });

    return response;
  } catch (err) {
    // El detalle de `GeminiError` trae el cuerpo que devolvio Google, que es donde esta el motivo
    // real; su `message` es siempre el mismo texto generico.
    const errorStatus = err instanceof GeminiError && err.status > 0 ? err.status : null;
    const errorMessage =
      err instanceof GeminiError
        ? err.detail || err.message
        : err instanceof Error
          ? err.message
          : String(err);

    await logInteraction(client, {
      ...ids,
      prompt,
      status: 'error',
      errorStatus,
      errorMessage,
    });

    throw err;
  }
}
