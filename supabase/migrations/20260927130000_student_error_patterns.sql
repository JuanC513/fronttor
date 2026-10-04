-- ============================================================================
-- En que se equivoca una y otra vez.
--
-- DEPENDE de 20260927120000_student_context.sql, que creo get_student_context()
-- con el perfil y el progreso. Esto le anade los patrones de error.
--
-- EL DATO YA ESTABA Y NADIE LO MIRABA
-- Cada fila de exercise_attempts guarda en `results` el veredicto CRITERIO A
-- CRITERIO, no solo si aprobo. De ahi sale "que errores suele cometer" con SQL
-- puro, sin una sola llamada al modelo.
--
-- Y cruzando cada resultado con exercises.criteria -que guarda el `type` en el
-- MISMO orden- sale algo mas transferible: de que TIPO son los criterios que
-- falla. "Se le da mal el CSS computado" vale para cualquier ejercicio; "fallo
-- el criterio 3" no vale para ninguno.
--
-- SOBRE EL COSTE
-- La agregacion nueva se acota a los ULTIMOS 50 intentos, y la cota no es una
-- concesion al rendimiento: es mas correcta. Un estudiante que se peleo con
-- element_exists la primera semana y ya lo domina no debe seguir descrito como
-- si fallara ahi. Interesa en que se equivoca ULTIMAMENTE, no un promedio de
-- toda su historia que cada vez se mueve menos.
--
-- De paso el coste deja de crecer: es el mismo el primer dia que el ultimo.
--
-- `atascados` sigue SIN acotar, y tambien es deliberado: "nunca lo aprobo"
-- necesita la historia completa, porque pudo aprobarlo hace cien intentos. A
-- cambio es un agregado de contadores, sin trabajo sobre jsonb, que es la parte
-- cara.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. El indice que necesita este acceso
--
-- Ya existe exercise_attempts_user_exercise_idx (user_id, exercise_id), que
-- sirve para filtrar por usuario pero obliga a ordenar despues para quedarse
-- con los ultimos N. Con (user_id, id desc), "los ultimos 50 de este
-- estudiante" se lee directo del indice: sin ordenacion y sin tocar las filas
-- de los demas.
-- ----------------------------------------------------------------------------

create index if not exists exercise_attempts_user_recent_idx
  on public.exercise_attempts (user_id, id desc);


-- ----------------------------------------------------------------------------
-- 2. La funcion, con dos campos mas
--
-- EL GUARDIA DEL CRUCE POR POSICION
-- `results` y `criteria` se corresponden por indice porque `resultsFor` los
-- genera en el mismo orden. Pero si el profesor edito los criterios DESPUES de
-- que el estudiante enviara, las dos listas dejan de corresponderse y el tipo
-- saldria cambiado. Por eso solo se cuenta cuando las longitudes coinciden: un
-- intento viejo con criterios nuevos no dice nada util, asi que se descarta
-- entero en vez de inventar.
-- ----------------------------------------------------------------------------

create or replace function public.get_student_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ultimos as (
    select a.exercise_id, a.results
    from exercise_attempts a
    where a.user_id = auth.uid()
    order by a.id desc
    limit 50
  ),
  criterios as (
    select
      e.criteria -> (r.idx::int - 1) ->> 'type' as tipo,
      r.res ->> 'description'                   as descripcion,
      (r.res ->> 'passed')::boolean             as paso
    from ultimos u
    join exercises e on e.id = u.exercise_id
    cross join lateral jsonb_array_elements(u.results) with ordinality as r(res, idx)
    where jsonb_array_length(e.criteria) = jsonb_array_length(u.results)
  )
  select jsonb_build_object(
    -- Lo que el estudiante escribio de si mismo. Contenido NO confiable aguas abajo.
    'perfil', (
      select p.profile_description from profiles p where p.user_id = auth.uid()
    ),

    'subtemasCompletados', (
      select count(*) from lesson_progress lp
      where lp.user_id = auth.uid() and lp.status = 'completed'
    ),
    'subtemasPublicados', (select count(*) from lessons where is_published),

    -- El mas reciente primero: es el que tiene entre manos ahora mismo.
    'enCurso', (
      select coalesce(jsonb_agg(l.name order by lp.updated_at desc), '[]'::jsonb)
      from lesson_progress lp
      join lessons l on l.id = lp.lesson_id
      where lp.user_id = auth.uid()
        and lp.status = 'in_progress'
        and l.is_published
    ),

    -- Distinct: un ejercicio aprobado dos veces no son dos ejercicios.
    'ejerciciosAprobados', (
      select count(distinct a.exercise_id) from exercise_attempts a
      where a.user_id = auth.uid() and a.passed
    ),
    'ejerciciosPublicados', (select count(*) from exercises where is_published),

    -- Donde lo ha intentado y NUNCA ha aprobado. `bool_and(not passed)` es "ninguno
    -- de sus intentos aprobo": con un `where not passed` se colarian los ejercicios
    -- que fallo antes de acertar, que son justo los que YA resolvio.
    'atascados', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('ejercicio', e.name, 'subtema', l.name, 'intentos', f.intentos)
          order by f.intentos desc
        ),
        '[]'::jsonb
      )
      from (
        select a.exercise_id, count(*) as intentos
        from exercise_attempts a
        where a.user_id = auth.uid()
        group by a.exercise_id
        having bool_and(not a.passed)
      ) f
      join exercises e on e.id = f.exercise_id
      join lessons l on l.id = e.lesson_id
      where e.is_published
    ),

    -- Cuantos envios cubre la ventana. Va en el prompt para que el tutor no hable
    -- de "siempre" cuando en realidad son tres intentos.
    'enviosRecientes', (select count(*) from ultimos),

    -- El dato transferible: de que TIPO son los criterios que falla. Solo se
    -- informan los tipos en los que ha fallado algo; los que domina no aportan.
    'fallosPorTipo', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('tipo', t.tipo, 'fallos', t.fallos, 'total', t.total)
          order by t.fallos desc
        ),
        '[]'::jsonb
      )
      from (
        select
          c.tipo,
          count(*) filter (where not c.paso) as fallos,
          count(*)                           as total
        from criterios c
        where c.tipo is not null
        group by c.tipo
        having count(*) filter (where not c.paso) > 0
      ) t
    ),

    -- El dato concreto: lo que se le olvida siempre. Tres veces es el umbral
    -- donde deja de ser un despiste y empieza a ser una costumbre.
    'criteriosRepetidos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('descripcion', d.descripcion, 'fallos', d.fallos)
          order by d.fallos desc
        ),
        '[]'::jsonb
      )
      from (
        select c.descripcion, count(*) as fallos
        from criterios c
        where not c.paso and c.descripcion is not null
        group by c.descripcion
        having count(*) >= 3
      ) d
    )
  );
$$;

comment on function public.get_student_context() is
  'Perfil escrito + progreso y patrones de error calculados del usuario actual. Lo consumen los prompts del estudiante.';


-- ----------------------------------------------------------------------------
-- 3. Permisos
--
-- `create or replace` conserva los del original, pero se repiten porque es
-- barato y no conviene que la seguridad de esta funcion dependa de recordar
-- que esta migracion reemplaza y no crea.
-- ----------------------------------------------------------------------------

revoke all on function public.get_student_context() from public, anon;
grant execute on function public.get_student_context() to authenticated;

notify pgrst, 'reload schema';
