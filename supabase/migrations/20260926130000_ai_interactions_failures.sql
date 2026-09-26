-- ============================================================================
-- ai_interactions deja de contar solo los exitos.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea la tabla,
-- y de 20260922120000_attempt_feedback.sql, que la estreno: hasta entonces
-- nadie escribia en ella.
--
-- EL PROBLEMA
-- logInteraction() se llama DESPUES de tener la respuesta del modelo, asi que
-- una llamada que falla no deja fila. La tabla dice entonces "N interacciones,
-- N exitos, 100%", y eso no es un hueco de observabilidad: es un sesgo, porque
-- mide solo el numerador.
--
-- No es hipotetico. Durante las pruebas de esta misma semana, Gemini devolvio
-- 503 (modelo saturado) decenas de veces y 429 (cuota agotada) durante un dia
-- entero, hasta el punto de que la generacion de ejercicios estuvo caida para
-- todo el mundo. En la tabla no hay ni una fila de eso.
--
-- QUE HABILITA
-- Con estas tres columnas se puede responder "cuantas veces el tutor no pudo
-- contestarle al estudiante" y, sobre todo, "por que": distinguir 429 de 503 es
-- distinguir "nos pasamos de cuota" -que se arregla con control de ritmo- de
-- "el modelo estaba saturado" -que se arregla cambiando de modelo o
-- reintentando-. Son decisiones opuestas y hoy se ven igual: como nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las tres columnas
--
-- `status` es el discriminador y va con default 'ok': las filas que ya existen
-- son todas exitos -no habia otra forma de llegar a la tabla-, asi que el
-- default las clasifica bien sin tocarlas.
--
-- `error_status` es el codigo HTTP que devolvio Gemini cuando se conoce. Es una
-- columna aparte y no texto dentro del mensaje porque la pregunta que importa
-- -cuantos 429 contra cuantos 503- es una agregacion, no una busqueda.
--
-- `error_message` guarda el detalle. Un fallo puede no tener codigo: una caida
-- de red o un JSON roto tambien dejan fila, con `status = 'error'` y
-- `error_status` en null. De ahi que el discriminador no se pueda deducir de si
-- hay codigo o no.
--
-- `response` se queda en NULL cuando hay error, que es lo honesto: no hubo.
-- `prompt` SI se guarda, porque saber que se le pidio al modelo cuando fallo es
-- la mitad del diagnostico.
-- ----------------------------------------------------------------------------

alter table public.ai_interactions
  add column if not exists status text not null default 'ok',
  add column if not exists error_status integer,
  add column if not exists error_message text;

alter table public.ai_interactions
  drop constraint if exists ai_interactions_status_check;

alter table public.ai_interactions
  add constraint ai_interactions_status_check check (status in ('ok', 'error'));

comment on column public.ai_interactions.status is
  'ok = el modelo respondio. error = la llamada fallo y no hay response.';
comment on column public.ai_interactions.error_status is
  'Codigo HTTP de Gemini cuando se conoce: 429 cuota, 503 saturado. NULL si el fallo fue de red.';


-- ----------------------------------------------------------------------------
-- 2. Un indice para la consulta que se va a hacer siempre
--
-- "cuantos fallos hubo y de que tipo, por fecha". El indice parcial solo cubre
-- las filas con error, que son -o deberian ser- la minoria: ocupa poco y
-- responde justo esa pregunta.
-- ----------------------------------------------------------------------------

create index if not exists ai_interactions_errors_idx
  on public.ai_interactions (created_at desc)
  where status = 'error';


-- ----------------------------------------------------------------------------
-- 3. No hacen falta grants nuevos
--
-- El GRANT SELECT, INSERT de 20260818120000 es de tabla, no de columnas, asi
-- que alcanza tambien a las que se acaban de anadir. La policy de insercion
-- -with check (user_id = auth.uid())- tampoco cambia: sigue siendo el usuario
-- quien registra su propia interaccion, falle o no.
--
-- El notify si hace falta: PostgREST cachea el esquema, y sin esto las columnas
-- nuevas no existen para la API hasta que el servicio se reinicie.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
