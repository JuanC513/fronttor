-- ============================================================================
-- Retroalimentacion de la IA sobre un intento.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea
-- exercise_attempts con su columna feedback -vacia desde entonces- y decide
-- que authenticated NO tenga UPDATE sobre esa tabla.
--
-- POR QUE UNA RPC Y NO UN UPDATE DESDE EL CLIENTE
-- Escribir la columna desde Angular exigiria conceder UPDATE sobre
-- exercise_attempts y crear una policy de update, y eso alcanzaria a TODAS las
-- columnas: el codigo enviado, los resultados y passed. Un intento es el
-- registro de lo que hizo el estudiante y no se reescribe. La unica excepcion
-- contemplada es esta, y vive del lado del servidor tocando una sola columna
-- de una sola fila.
--
-- POR QUE EL ID DEL INTENTO Y NO EL DEL EJERCICIO
-- Entre que el estudiante envia y que el modelo contesta pasan segundos. Si en
-- ese rato reenvia -que es el comportamiento natural: "fallo, sigo trasteando"-
-- "su intento mas reciente" ya es otro, y la pista del envio anterior
-- aterrizaria sobre el nuevo. El profesor leeria en exercise_attempts una
-- retroalimentacion que no describe el codigo de esa fila, que es exactamente
-- lo contrario de para lo que existe la columna. Por eso submit_exercise_attempt
-- pasa a devolver el id: para que no haya que adivinarlo.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. submit_exercise_attempt devuelve el id del intento
--
-- Se suelta antes de recrearse porque create or replace NO puede cambiar el
-- tipo de retorno. Es seguro: esta funcion no tiene dependientes -ninguna
-- policy, vista ni trigger la nombra-, a diferencia de is_admin() en
-- 20260921120000, donde el drop habria arrastrado 15 policies.
--
-- Al soltar una funcion se pierden sus permisos, de ahi el revoke y el grant
-- que la siguen. El cuerpo es identico al de 20260818120000; lo unico que
-- cambia es que el INSERT devuelve el id y la funcion lo retorna.
-- ----------------------------------------------------------------------------

drop function if exists public.submit_exercise_attempt(
  integer, text, text, text, boolean, jsonb
);

create or replace function public.submit_exercise_attempt(
  p_exercise_id integer,
  p_html        text,
  p_css         text,
  p_js          text,
  p_passed      boolean,
  p_results     jsonb DEFAULT '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  v_user_id    uuid := auth.uid();
  v_lesson_id  INTEGER;
  v_attempt_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT lesson_id INTO v_lesson_id FROM exercises WHERE id = p_exercise_id;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'El ejercicio no existe' USING ERRCODE = '23503';
  END IF;

  INSERT INTO exercise_attempts (
    user_id, exercise_id, submitted_html, submitted_css, submitted_js, passed, results
  )
  VALUES (
    v_user_id, p_exercise_id, p_html, p_css, p_js, p_passed, p_results
  )
  RETURNING id INTO v_attempt_id;

  INSERT INTO lesson_progress (user_id, lesson_id, status)
  VALUES (v_user_id, v_lesson_id, 'in_progress')
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  IF p_passed THEN
    PERFORM recompute_lesson_progress(v_user_id, v_lesson_id);
  END IF;

  RETURN v_attempt_id;
END;
$function$;

-- `from public, anon` y no solo `from anon`: ver la seccion 3.
revoke all on function public.submit_exercise_attempt(
  integer, text, text, text, boolean, jsonb
) from public, anon;

grant execute on function public.submit_exercise_attempt(
  integer, text, text, text, boolean, jsonb
) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. La RPC que escribe la retroalimentacion
--
-- El id del intento llega del cliente y por si solo no autoriza nada: la
-- clausula user_id = auth.uid() es lo unico que impide escribir sobre el
-- intento de otra persona. Sin ella, security definer convertiria esto en un
-- update arbitrario sobre toda la tabla.
--
-- No hace falta grant de UPDATE ni policy de update sobre exercise_attempts: la
-- funcion corre como su dueno, que es tambien el de la tabla, y el dueno no
-- pasa por la RLS.
--
-- Si el id no existe o no es del usuario no se actualiza nada y no se levanta
-- error: la retroalimentacion es accesoria y no debe hacer fallar una pantalla
-- que ya le mostro la pista al estudiante.
--
-- El left() acota lo que se guarda. No es una validacion de contenido: como
-- `passed`, esto lo manda el cliente y un estudiante podria escribir ahi lo que
-- quisiera sobre su propio intento. Es la misma limitacion ya documentada en
-- exercise-attempt-model.ts, y cerrarla exigiria que la Edge Function escribiera
-- con service_role.
-- ----------------------------------------------------------------------------

drop function if exists public.set_attempt_feedback(integer, text);

create or replace function public.set_attempt_feedback(
  p_attempt_id integer,
  p_feedback   text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  UPDATE exercise_attempts
  SET feedback = left(p_feedback, 1000)
  WHERE id = p_attempt_id
    AND user_id = v_user_id;
END;
$function$;

revoke all on function public.set_attempt_feedback(integer, text) from public, anon;
grant execute on function public.set_attempt_feedback(integer, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Cerrar el EXECUTE que PostgreSQL concede a PUBLIC
--
-- Al crear una funcion, PostgreSQL le concede EXECUTE a PUBLIC. Las migraciones
-- anteriores de este proyecto hacen `revoke all on function ... from anon`, que
-- quita la concesion DIRECTA de anon pero deja intacta la de PUBLIC -de la que
-- anon y authenticated forman parte-. El resultado es que las funciones que se
-- creian cerradas siguen siendo ejecutables. Se comprueba asi:
--
--   select has_function_privilege('anon',
--            'public.recompute_lesson_progress(uuid, integer)', 'execute');
--
-- De todas las funciones del esquema, la unica donde esto tiene consecuencias
-- es recompute_lesson_progress, y por un motivo concreto: es la unica
-- security definer que recibe el id de usuario COMO PARAMETRO en vez de
-- resolverlo con auth.uid(). Su propio comentario en 20260818120000 dice que no
-- se concede a nadie justamente por eso.
--
-- El alcance real es limitado -solo actualiza filas que ya existen, y solo marca
-- completado lo que ese usuario ya tiene aprobado, asi que no fabrica progreso-,
-- pero es una llamada que nadie deberia poder hacer sobre otra persona.
--
-- Las demas RPC no se tocan aqui: son de contenido, NO son security definer, y
-- lo que de verdad las detiene es la RLS de sus tablas.
-- ----------------------------------------------------------------------------

revoke all on function public.recompute_lesson_progress(uuid, integer) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. Cache de esquema de PostgREST
--
-- PostgREST enruta /rpc/<nombre> desde un cache en memoria. Supabase tiene un
-- event trigger que dispara este notify solo en cada DDL de funcion, pero se
-- repite explicito porque no cuesta nada y cubre la ventana en la que una
-- llamada a set_attempt_feedback podria responder PGRST202 mientras el cache se
-- repuebla.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';


-- ============================================================================
-- Comprobacion
--
--   -- Una sola firma viva de cada una, y submit devolviendo integer
--   select proname,
--          pg_get_function_identity_arguments(oid) as args,
--          pg_get_function_result(oid)             as retorna
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('submit_exercise_attempt', 'set_attempt_feedback')
--   order by 1;
--
--   -- Ni PUBLIC ni anon pueden con las tres; authenticated si con las dos
--   -- primeras y no con la tercera
--   select has_function_privilege('anon',
--            'public.set_attempt_feedback(integer, text)', 'execute')          as anon_feedback,
--          has_function_privilege('authenticated',
--            'public.set_attempt_feedback(integer, text)', 'execute')          as auth_feedback,
--          has_function_privilege('authenticated',
--            'public.recompute_lesson_progress(uuid, integer)', 'execute')     as auth_recompute;
--   -- esperado: false, true, false
--
--   -- authenticated sigue SIN update sobre la tabla: la RPC no lo necesita
--   select privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'exercise_attempts'
--     and grantee = 'authenticated';
--   -- esperado: INSERT, SELECT
-- ============================================================================
