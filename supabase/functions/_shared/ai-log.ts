import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Espejo del check de la columna `kind` en `ai_interactions`. */
export type AiKind = 'question' | 'feedback' | 'content' | 'exercise';

export interface AiInteractionLog {
  userId: string;
  kind: AiKind;
  model: string;
  prompt: string;
  response: string;
  lessonId?: number;
  exerciseId?: number;
}

/**
 * Deja constancia de una llamada al modelo en `ai_interactions`.
 *
 * La tabla existe desde la primera migracion y hasta ahora no la escribia nadie: es la unica forma
 * de responder despues a "cuanta IA se uso, para que y con que resultado", que en un sistema cuyo
 * argumento es la retroalimentacion personalizada no es un dato accesorio.
 *
 * ## Es un efecto secundario y se comporta como tal
 *
 * Se llama DESPUES de tener la respuesta del modelo y ANTES de devolverla. Nunca lanza: si el
 * registro falla, el estudiante recibe igual lo que pidio. Lo contrario seria absurdo -perder una
 * respuesta que costo varios segundos de cuota porque no se pudo anotar que ocurrio-.
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
      response: entry.response,
      lesson_id: entry.lessonId ?? null,
      exercise_id: entry.exerciseId ?? null,
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
