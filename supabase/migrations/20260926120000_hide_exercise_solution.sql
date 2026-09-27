-- ============================================================================
-- La solucion de referencia deja de estar al alcance de la API.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea
-- exercises con sus columnas solution_* y le concede a authenticated un SELECT
-- sobre la tabla entera, y de 20260919120100_tighten_content_grants.sql, que
-- ajusto otros grants de contenido pero no toco este.
--
-- EL AGUJERO
-- La policy de lectura era "exercises_select_authenticated ... using (true)" y
-- el grant, SELECT sobre la tabla completa. Es decir: cualquier usuario con
-- sesion podia pedir
--     /rest/v1/exercises?select=solution_html
-- y recibir la respuesta de todos los ejercicios, incluidos los que aun estan
-- en borrador. En un sistema que califica, eso vacia el ejercicio.
--
-- El frontend ya lo esquivaba -getForStudent enumera columnas en vez de usar
-- select('*')- pero eso son buenos modales del cliente, no una frontera: quien
-- sepa pedirle la columna a PostgREST la recibe igual.
--
-- POR QUE NO BASTA CON UNA POLICY
-- Estudiantes y profesores son el MISMO rol de Postgres: authenticated. Los
-- grant de columna son por rol, asi que no pueden distinguirlos, y las policies
-- de RLS son por fila, no por columna. Ninguno de los dos mecanismos, por si
-- solo, deja leer solution_* a unos y no a otros.
--
-- La salida es separar los dos caminos: NADIE lee esas columnas por la tabla, y
-- el profesor las recibe por una funcion security definer que comprueba el rol
-- por dentro. Tiene una consecuencia que conviene enunciar porque sorprende al
-- probarlo: despues de esta migracion, la peticion de arriba falla TAMBIEN para
-- un profesor. El revoke es del rol, no de la persona.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Lectura por columnas
--
-- Se revoca el SELECT de tabla y se devuelve columna a columna, dejando fuera
-- las tres de solucion. INSERT, UPDATE y DELETE no se tocan: el profesor sigue
-- ESCRIBIENDO la solucion por insert_exercise y update_exercise, que son
-- security invoker y se apoyan en las policies de escritura.
--
-- Que esas dos RPC sigan funcionando no es casualidad ni suerte: ninguna LEE
-- las columnas de solucion -solo las insertan o las asignan-, y un UPDATE con
-- WHERE solo exige SELECT sobre las columnas del WHERE, que aqui es id.
-- delete_exercise lee "order" y lesson_id, que siguen concedidas.
--
-- Efecto colateral buscado: un select('*') pasa a fallar con "permission denied
-- for column". Es ruidoso y aparece en desarrollo, que es mucho mejor que un
-- silencio que se descubre en produccion.
-- ----------------------------------------------------------------------------

revoke select on table public.exercises from authenticated;

grant select (
  id,
  lesson_id,
  name,
  statement,
  difficulty,
  starter_html,
  starter_css,
  starter_js,
  criteria,
  source,
  is_published,
  "order",
  created_at
) on table public.exercises to authenticated;


-- ----------------------------------------------------------------------------
-- 2. La puerta del profesor
--
-- El formulario de edicion es el UNICO sitio que necesita la solucion: la carga
-- en sus pestanas y la usa para comprobar que los criterios esten bien
-- escritos. Como ya no puede leerla por la tabla, se le da por aqui.
--
-- is_teacher() va DENTRO del where y no como un raise: sin rol no hay filas, no
-- una excepcion. Para quien llama es indistinguible de "ese ejercicio no
-- existe", que es justo lo que debe parecer.
--
-- El revoke ... from public no es decorativo. Postgres concede EXECUTE a PUBLIC
-- por defecto en cada funcion nueva, asi que revocar solo a anon no haria nada:
-- es el mismo descuido que ya se corrigio en 20260922120000 para
-- recompute_lesson_progress.
-- ----------------------------------------------------------------------------

create or replace function public.get_exercise_for_edit(p_id integer)
returns setof public.exercises
language sql
stable
security definer
set search_path = public
as $$
  select * from public.exercises where id = p_id and public.is_teacher();
$$;

comment on function public.get_exercise_for_edit(integer) is
  'Unica lectura de solution_* que queda. authenticated no tiene SELECT sobre esas columnas.';

revoke all on function public.get_exercise_for_edit(integer) from public, anon;
grant execute on function public.get_exercise_for_edit(integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Los borradores
--
-- El mismo agujero un escalon mas abajo: con using (true), un estudiante podia
-- leer el enunciado y los criterios de un ejercicio sin publicar.
--
-- No cambia el comportamiento de nada que exista hoy. Las dos lecturas del
-- estudiante -getPublishedForStudent y getForStudent- ya filtran por
-- is_published por su cuenta, y las del profesor quedan cubiertas por la
-- segunda rama.
-- ----------------------------------------------------------------------------

drop policy if exists "exercises_select_authenticated" on public.exercises;

create policy "exercises_select_published_or_teacher"
  on public.exercises
  for select
  to authenticated
  using (is_published or public.is_teacher());


-- ----------------------------------------------------------------------------
-- 4. PostgREST sirve /rpc/ desde una cache en memoria: sin esto, la funcion
--    nueva responde 404 hasta que el servicio se reinicie por su cuenta.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
