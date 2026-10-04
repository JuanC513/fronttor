


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."delete_block"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
  v_lesson_id INTEGER;
BEGIN
  SELECT "order", lesson_id INTO v_order, v_lesson_id FROM blocks WHERE id = p_id;
  DELETE FROM blocks WHERE id = p_id;
  UPDATE blocks SET "order" = "order" - 1
  WHERE lesson_id = v_lesson_id AND "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_block"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_exercise"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order     INTEGER;
  v_lesson_id INTEGER;
BEGIN
  SELECT "order", lesson_id INTO v_order, v_lesson_id FROM exercises WHERE id = p_id;
  DELETE FROM exercises WHERE id = p_id;
  UPDATE exercises SET "order" = "order" - 1
  WHERE lesson_id = v_lesson_id AND "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_exercise"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_lesson"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
  v_module_id INTEGER;
BEGIN
  SELECT "order", module_id INTO v_order, v_module_id FROM lessons WHERE id = p_id;
  DELETE FROM lessons WHERE id = p_id;
  UPDATE lessons SET "order" = "order" - 1
  WHERE module_id = v_module_id AND "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_lesson"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_module"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
BEGIN
  SELECT "order" INTO v_order FROM modules WHERE id = p_id;
  DELETE FROM modules WHERE id = p_id;
  UPDATE modules SET "order" = "order" - 1 WHERE "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_module"("p_id" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" integer NOT NULL,
    "lesson_id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "statement" "text" NOT NULL,
    "difficulty" "text" DEFAULT 'media'::"text" NOT NULL,
    "starter_html" "text" DEFAULT ''::"text" NOT NULL,
    "starter_css" "text" DEFAULT ''::"text" NOT NULL,
    "starter_js" "text" DEFAULT ''::"text" NOT NULL,
    "criteria" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "solution_html" "text" DEFAULT ''::"text" NOT NULL,
    "solution_css" "text" DEFAULT ''::"text" NOT NULL,
    "solution_js" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "exercises_criteria_check" CHECK (("jsonb_typeof"("criteria") = 'array'::"text")),
    CONSTRAINT "exercises_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['facil'::"text", 'media'::"text", 'dificil'::"text"]))),
    CONSTRAINT "exercises_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'ia'::"text"])))
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_exercise_for_edit"("p_id" integer) RETURNS SETOF "public"."exercises"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select * from public.exercises where id = p_id and public.is_teacher();
$$;


ALTER FUNCTION "public"."get_exercise_for_edit"("p_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_exercise_for_edit"("p_id" integer) IS 'Unica lectura de solution_* que queda. authenticated no tiene SELECT sobre esas columnas.';



CREATE OR REPLACE FUNCTION "public"."get_my_tutor_activity"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with mias as (
    select kind, lesson_id, created_at
    from ai_interactions
    where user_id = auth.uid()
      and status = 'ok'
  )
  select jsonb_build_object(
    'preguntas', (select count(*) from mias where kind = 'question'),
    'pistas',    (select count(*) from mias where kind = 'feedback'),
    'practicas', (select count(*) from mias where kind = 'exercise'),

    -- La ultima, para poder decir de que iba. El left join es necesario: las
    -- practicas generadas en el taller libre no cuelgan de ningun subtema, y una
    -- interaccion sobre un subtema ya borrado tampoco debe esconder la fila.
    'ultima', (
      select jsonb_build_object(
        'tipo',    m.kind,
        'cuando',  m.created_at,
        'subtema', l.name
      )
      from mias m
      left join lessons l on l.id = m.lesson_id
      order by m.created_at desc
      limit 1
    )
  );
$$;


ALTER FUNCTION "public"."get_my_tutor_activity"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_tutor_activity"() IS 'Cuantas veces ha usado el tutor el usuario actual, y de que iba la ultima. Solo el agregado: no da acceso a las filas, que llevan el prompt.';



CREATE OR REPLACE FUNCTION "public"."get_student_context"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_student_context"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_student_context"() IS 'Perfil escrito + progreso y patrones de error calculados del usuario actual. Lo consumen los prompts del estudiante.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email);

  insert into public.user_roles (user_id, role_id)
  select new.id, id from public.roles where name = 'student';

  if not found then
    raise exception 'No existe el rol student en public.roles; revisa seed.sql';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = p_role
  );
$$;


ALTER FUNCTION "public"."has_role"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO blocks (name, content, lesson_id, "order", is_published)
  VALUES (
    p_name,
    p_content,
    p_lesson_id,
    COALESCE((SELECT MAX("order") FROM blocks WHERE lesson_id = p_lesson_id), 0) + 1,
    p_is_published
  );
END;
$$;


ALTER FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_exercise"("p_lesson_id" integer, "p_name" "text", "p_statement" "text", "p_difficulty" "text" DEFAULT 'media'::"text", "p_starter_html" "text" DEFAULT ''::"text", "p_starter_css" "text" DEFAULT ''::"text", "p_starter_js" "text" DEFAULT ''::"text", "p_solution_html" "text" DEFAULT ''::"text", "p_solution_css" "text" DEFAULT ''::"text", "p_solution_js" "text" DEFAULT ''::"text", "p_criteria" "jsonb" DEFAULT '[]'::"jsonb", "p_source" "text" DEFAULT 'manual'::"text", "p_is_published" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO exercises (
    lesson_id, name, statement, difficulty,
    starter_html, starter_css, starter_js,
    solution_html, solution_css, solution_js,
    criteria, source, is_published, "order"
  )
  VALUES (
    p_lesson_id,
    p_name,
    p_statement,
    p_difficulty,
    p_starter_html,
    p_starter_css,
    p_starter_js,
    p_solution_html,
    p_solution_css,
    p_solution_js,
    p_criteria,
    p_source,
    p_is_published,
    COALESCE((SELECT MAX("order") FROM exercises WHERE lesson_id = p_lesson_id), 0) + 1
  );
END;
$$;


ALTER FUNCTION "public"."insert_exercise"("p_lesson_id" integer, "p_name" "text", "p_statement" "text", "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer, "p_is_published" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO lessons (name, module_id, "order", is_published)
  VALUES (
    p_name,
    p_module_id,
    COALESCE((SELECT MAX("order") FROM lessons WHERE module_id = p_module_id), 0) + 1,
    p_is_published
  );
END;
$$;


ALTER FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer, "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_module"("p_name" "text", "p_is_published" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO modules (name, "order", is_published)
  VALUES (
    p_name,
    COALESCE((SELECT MAX("order") FROM modules), 0) + 1,
    p_is_published
  );
END;
$$;


ALTER FUNCTION "public"."insert_module"("p_name" "text", "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_teacher"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.has_role('teacher');
$$;


ALTER FUNCTION "public"."is_teacher"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_teacher"() IS 'Criterio unico de "puede gestionar el contenido del curso". La invocan las 15 policies de escritura y las Edge Functions por RPC.';



CREATE OR REPLACE FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with consumibles as (
    select
      l.id,
      l.module_id,
      -- l.id como ultimo criterio para que la secuencia sea determinista.
      -- reorder_lessons mantiene los `order` sin repetir, asi que no deberia
      -- hacer falta; si alguna vez se repiten, esto evita que este orden y el de
      -- PostgREST -que ordena solo por `order`- salgan distintos.
      row_number() over (order by m."order", l."order", l.id) as pos
    from lessons l
    join modules m on m.id = l.module_id
    where l.is_published
      and m.is_published
      and exists (select 1 from blocks b where b.lesson_id = l.id and b.is_published)
  ),
  objetivo as (
    select pos, module_id from consumibles where id = p_lesson_id
  ),
  previo as (
    select c.id, c.module_id
    from consumibles c
    join objetivo o on c.pos = o.pos - 1
  )
  select
    -- El primero del curso esta siempre abierto: sin esa excepcion nadie podria
    -- empezar nunca, porque todo lo demas depende de algo anterior.
    o.pos = 1
    or case
         -- Dentro del tema: haber ABIERTO el anterior.
         when p.module_id = o.module_id then exists (
           select 1 from lesson_progress lp
           where lp.user_id = auth.uid()
             and lp.lesson_id = p.id
         )
         -- Abre tema: el anterior COMPLETO. Se expresa como "ningun subtema suyo
         -- sin fila completada" y no con bool_and() porque bool_and ignora los
         -- NULL: con un left join a lesson_progress, un tema donde el estudiante
         -- no ha abierto nada daria NULL en vez de false.
         else not exists (
           select 1 from consumibles c
           where c.module_id = p.module_id
             and not exists (
               select 1 from lesson_progress lp
               where lp.user_id = auth.uid()
                 and lp.lesson_id = c.id
                 and lp.status = 'completed'
             )
         )
       end
  from objetivo o
  left join previo p on true;
$$;


ALTER FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) IS 'Si el usuario actual puede abrir ese subtema. NULL si el subtema no es parte del recorrido. Replica lessonAvailability() de learning-progress.ts.';



CREATE OR REPLACE FUNCTION "public"."mark_lesson_viewed"("p_lesson_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_alcanzable boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT public.lesson_is_reachable(p_lesson_id) INTO v_alcanzable;

  IF v_alcanzable IS NULL THEN
    RETURN;
  END IF;

  IF NOT v_alcanzable THEN
    RAISE EXCEPTION 'Este subtema todavia no esta disponible'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO lesson_progress (user_id, lesson_id, status)
  VALUES (v_user_id, p_lesson_id, 'in_progress')
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  PERFORM recompute_lesson_progress(v_user_id, p_lesson_id);
END;
$$;


ALTER FUNCTION "public"."mark_lesson_viewed"("p_lesson_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_lesson_progress"("p_user_id" "uuid", "p_lesson_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total  INTEGER;
  v_passed INTEGER;
BEGIN
  SELECT count(*) INTO v_total
  FROM exercises
  WHERE lesson_id = p_lesson_id
    AND is_published;

  SELECT count(DISTINCT e.id) INTO v_passed
  FROM exercises e
  JOIN exercise_attempts a ON a.exercise_id = e.id
  WHERE e.lesson_id = p_lesson_id
    AND e.is_published
    AND a.user_id = p_user_id
    AND a.passed;

  IF v_total = v_passed THEN
    UPDATE lesson_progress
    SET status                  = 'completed',
        completed_at            = COALESCE(completed_at, now()),
        exercises_at_completion = COALESCE(exercises_at_completion, v_total),
        updated_at              = now()
    WHERE user_id = p_user_id
      AND lesson_id = p_lesson_id
      AND status <> 'completed';
  END IF;
END;
$$;


ALTER FUNCTION "public"."recompute_lesson_progress"("p_user_id" "uuid", "p_lesson_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_blocks"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE blocks SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE blocks SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_blocks"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_exercises"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE exercises SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE exercises SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_exercises"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_lessons"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE lessons SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE lessons SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_lessons"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_modules"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Primero mueve todos a valores negativos temporales para liberar todas las posiciones
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE modules SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  -- Luego asigna los valores finales según la posición en el array
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE modules SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_modules"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attempt_feedback"("p_attempt_id" integer, "p_feedback" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."set_attempt_feedback"("p_attempt_id" integer, "p_feedback" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_exercise_attempt"("p_exercise_id" integer, "p_html" "text", "p_css" "text", "p_js" "text", "p_passed" boolean, "p_results" "jsonb" DEFAULT '[]'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_lesson_id  INTEGER;
  v_alcanzable BOOLEAN;
  v_attempt_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT lesson_id INTO v_lesson_id FROM exercises WHERE id = p_exercise_id;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'El ejercicio no existe' USING ERRCODE = '23503';
  END IF;

  SELECT public.lesson_is_reachable(v_lesson_id) INTO v_alcanzable;

  IF v_alcanzable IS NOT TRUE THEN
    RAISE EXCEPTION 'Este subtema todavia no esta disponible'
      USING ERRCODE = '42501';
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
$$;


ALTER FUNCTION "public"."submit_exercise_attempt"("p_exercise_id" integer, "p_html" "text", "p_css" "text", "p_js" "text", "p_passed" boolean, "p_results" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE blocks
  SET name         = p_name,
      content      = p_content,
      lesson_id    = p_lesson_id,
      is_published = p_is_published
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_exercise"("p_id" integer, "p_name" "text", "p_statement" "text", "p_lesson_id" integer, "p_difficulty" "text" DEFAULT 'media'::"text", "p_starter_html" "text" DEFAULT ''::"text", "p_starter_css" "text" DEFAULT ''::"text", "p_starter_js" "text" DEFAULT ''::"text", "p_solution_html" "text" DEFAULT ''::"text", "p_solution_css" "text" DEFAULT ''::"text", "p_solution_js" "text" DEFAULT ''::"text", "p_criteria" "jsonb" DEFAULT '[]'::"jsonb", "p_source" "text" DEFAULT 'manual'::"text", "p_is_published" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE exercises
  SET name          = p_name,
      statement     = p_statement,
      lesson_id     = p_lesson_id,
      difficulty    = p_difficulty,
      starter_html  = p_starter_html,
      starter_css   = p_starter_css,
      starter_js    = p_starter_js,
      solution_html = p_solution_html,
      solution_css  = p_solution_css,
      solution_js   = p_solution_js,
      criteria      = p_criteria,
      source        = p_source,
      is_published  = p_is_published
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_exercise"("p_id" integer, "p_name" "text", "p_statement" "text", "p_lesson_id" integer, "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer, "p_is_published" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE lessons
  SET name         = p_name,
      module_id    = p_module_id,
      is_published = p_is_published
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer, "p_is_published" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_module"("p_id" integer, "p_name" "text", "p_is_published" boolean) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE modules
  SET name         = p_name,
      is_published = p_is_published
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_module"("p_id" integer, "p_name" "text", "p_is_published" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_interactions" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "kind" "text" NOT NULL,
    "lesson_id" integer,
    "exercise_id" integer,
    "model" "text",
    "prompt" "text",
    "response" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "error_status" integer,
    "error_message" "text",
    CONSTRAINT "ai_interactions_kind_check" CHECK (("kind" = ANY (ARRAY['question'::"text", 'feedback'::"text", 'content'::"text", 'exercise'::"text"]))),
    CONSTRAINT "ai_interactions_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."ai_interactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_interactions"."status" IS 'ok = el modelo respondio. error = la llamada fallo y no hay response.';



COMMENT ON COLUMN "public"."ai_interactions"."error_status" IS 'Codigo HTTP de Gemini cuando se conoce: 429 cuota, 503 saturado. NULL si el fallo fue de red.';



ALTER TABLE "public"."ai_interactions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ai_interactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "content" "text",
    "lesson_id" integer,
    "order" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."blocks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."blocks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."blocks_id_seq" OWNED BY "public"."blocks"."id";



CREATE TABLE IF NOT EXISTS "public"."exercise_attempts" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exercise_id" integer NOT NULL,
    "submitted_html" "text" DEFAULT ''::"text" NOT NULL,
    "submitted_css" "text" DEFAULT ''::"text" NOT NULL,
    "submitted_js" "text" DEFAULT ''::"text" NOT NULL,
    "passed" boolean NOT NULL,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exercise_attempts_results_check" CHECK (("jsonb_typeof"("results") = 'array'::"text"))
);


ALTER TABLE "public"."exercise_attempts" OWNER TO "postgres";


ALTER TABLE "public"."exercise_attempts" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercise_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."exercises" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."exercises_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lesson_progress" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lesson_id" integer NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "exercises_at_completion" integer,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lesson_progress_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."lesson_progress" OWNER TO "postgres";


ALTER TABLE "public"."lesson_progress" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."lesson_progress_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "module_id" integer,
    "order" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lessons_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lessons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lessons_id_seq" OWNED BY "public"."lessons"."id";



CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."modules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."modules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."modules_id_seq" OWNED BY "public"."modules"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_description" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "name" character varying(50) NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blocks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."blocks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lessons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lessons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."modules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."modules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_order_per_lesson_unique" UNIQUE ("lesson_id", "order");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_attempts"
    ADD CONSTRAINT "exercise_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_order_per_lesson_unique" UNIQUE ("lesson_id", "order");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_lesson_unique" UNIQUE ("user_id", "lesson_id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_order_per_module_unique" UNIQUE ("module_id", "order");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_order_unique" UNIQUE ("order");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



CREATE INDEX "ai_interactions_created_at_idx" ON "public"."ai_interactions" USING "btree" ("created_at");



CREATE INDEX "ai_interactions_errors_idx" ON "public"."ai_interactions" USING "btree" ("created_at" DESC) WHERE ("status" = 'error'::"text");



CREATE INDEX "ai_interactions_user_recent_idx" ON "public"."ai_interactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "exercise_attempts_user_exercise_idx" ON "public"."exercise_attempts" USING "btree" ("user_id", "exercise_id");



CREATE INDEX "exercise_attempts_user_recent_idx" ON "public"."exercise_attempts" USING "btree" ("user_id", "id" DESC);



CREATE INDEX "exercises_lesson_id_idx" ON "public"."exercises" USING "btree" ("lesson_id");



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_interactions"
    ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_attempts"
    ADD CONSTRAINT "exercise_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_attempts"
    ADD CONSTRAINT "exercise_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE "public"."ai_interactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_interactions_insert_own" ON "public"."ai_interactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_interactions_select_teacher" ON "public"."ai_interactions" FOR SELECT TO "authenticated" USING ("public"."is_teacher"());



CREATE POLICY "attempts_insert_own" ON "public"."exercise_attempts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "attempts_select_own" ON "public"."exercise_attempts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "attempts_select_teacher" ON "public"."exercise_attempts" FOR SELECT TO "authenticated" USING ("public"."is_teacher"());



ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blocks_delete_teacher" ON "public"."blocks" FOR DELETE TO "authenticated" USING ("public"."is_teacher"());



CREATE POLICY "blocks_insert_teacher" ON "public"."blocks" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_teacher"());



CREATE POLICY "blocks_select_published_or_teacher" ON "public"."blocks" FOR SELECT TO "authenticated" USING (("public"."is_teacher"() OR ("is_published" AND (EXISTS ( SELECT 1
   FROM ("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
  WHERE (("l"."id" = "blocks"."lesson_id") AND "l"."is_published" AND "m"."is_published"))))));



CREATE POLICY "blocks_update_teacher" ON "public"."blocks" FOR UPDATE TO "authenticated" USING ("public"."is_teacher"()) WITH CHECK ("public"."is_teacher"());



ALTER TABLE "public"."exercise_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercises_delete_teacher" ON "public"."exercises" FOR DELETE TO "authenticated" USING ("public"."is_teacher"());



CREATE POLICY "exercises_insert_teacher" ON "public"."exercises" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_teacher"());



CREATE POLICY "exercises_select_published_or_teacher" ON "public"."exercises" FOR SELECT TO "authenticated" USING (("public"."is_teacher"() OR ("is_published" AND (EXISTS ( SELECT 1
   FROM ("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
  WHERE (("l"."id" = "exercises"."lesson_id") AND "l"."is_published" AND "m"."is_published"))))));



CREATE POLICY "exercises_update_teacher" ON "public"."exercises" FOR UPDATE TO "authenticated" USING ("public"."is_teacher"()) WITH CHECK ("public"."is_teacher"());



ALTER TABLE "public"."lesson_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lessons_delete_teacher" ON "public"."lessons" FOR DELETE TO "authenticated" USING ("public"."is_teacher"());



CREATE POLICY "lessons_insert_teacher" ON "public"."lessons" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_teacher"());



CREATE POLICY "lessons_select_published_or_teacher" ON "public"."lessons" FOR SELECT TO "authenticated" USING (("public"."is_teacher"() OR ("is_published" AND (EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND "m"."is_published"))))));



CREATE POLICY "lessons_update_teacher" ON "public"."lessons" FOR UPDATE TO "authenticated" USING ("public"."is_teacher"()) WITH CHECK ("public"."is_teacher"());



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_delete_teacher" ON "public"."modules" FOR DELETE TO "authenticated" USING ("public"."is_teacher"());



CREATE POLICY "modules_insert_teacher" ON "public"."modules" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_teacher"());



CREATE POLICY "modules_select_published_or_teacher" ON "public"."modules" FOR SELECT TO "authenticated" USING (("public"."is_teacher"() OR "is_published"));



CREATE POLICY "modules_update_teacher" ON "public"."modules" FOR UPDATE TO "authenticated" USING ("public"."is_teacher"()) WITH CHECK ("public"."is_teacher"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "progress_select_own" ON "public"."lesson_progress" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "progress_select_teacher" ON "public"."lesson_progress" FOR SELECT TO "authenticated" USING ("public"."is_teacher"());



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_select_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_block"("p_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_block"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_block"("p_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_exercise"("p_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_exercise"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_exercise"("p_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_module"("p_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_module"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_module"("p_id" integer) TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "service_role";
GRANT INSERT,DELETE,UPDATE ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("lesson_id") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("statement") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("difficulty") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("starter_html") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("starter_css") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("starter_js") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("criteria") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("source") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("order") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."exercises" TO "authenticated";



GRANT SELECT("is_published") ON TABLE "public"."exercises" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_exercise_for_edit"("p_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_exercise_for_edit"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_exercise_for_edit"("p_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_tutor_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_tutor_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_tutor_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_exercise"("p_lesson_id" integer, "p_name" "text", "p_statement" "text", "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_exercise"("p_lesson_id" integer, "p_name" "text", "p_statement" "text", "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_exercise"("p_lesson_id" integer, "p_name" "text", "p_statement" "text", "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer, "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer, "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer, "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."insert_module"("p_name" "text", "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."insert_module"("p_name" "text", "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_module"("p_name" "text", "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_teacher"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_teacher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_teacher"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lesson_is_reachable"("p_lesson_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_lesson_viewed"("p_lesson_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_lesson_viewed"("p_lesson_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_lesson_viewed"("p_lesson_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_lesson_progress"("p_user_id" "uuid", "p_lesson_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_lesson_progress"("p_user_id" "uuid", "p_lesson_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_exercises"("p_ids" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_exercises"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_exercises"("p_ids" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_attempt_feedback"("p_attempt_id" integer, "p_feedback" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_attempt_feedback"("p_attempt_id" integer, "p_feedback" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attempt_feedback"("p_attempt_id" integer, "p_feedback" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_exercise_attempt"("p_exercise_id" integer, "p_html" "text", "p_css" "text", "p_js" "text", "p_passed" boolean, "p_results" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_exercise_attempt"("p_exercise_id" integer, "p_html" "text", "p_css" "text", "p_js" "text", "p_passed" boolean, "p_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_exercise_attempt"("p_exercise_id" integer, "p_html" "text", "p_css" "text", "p_js" "text", "p_passed" boolean, "p_results" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer, "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_exercise"("p_id" integer, "p_name" "text", "p_statement" "text", "p_lesson_id" integer, "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_exercise"("p_id" integer, "p_name" "text", "p_statement" "text", "p_lesson_id" integer, "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_exercise"("p_id" integer, "p_name" "text", "p_statement" "text", "p_lesson_id" integer, "p_difficulty" "text", "p_starter_html" "text", "p_starter_css" "text", "p_starter_js" "text", "p_solution_html" "text", "p_solution_css" "text", "p_solution_js" "text", "p_criteria" "jsonb", "p_source" "text", "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer, "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer, "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer, "p_is_published" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text", "p_is_published" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text", "p_is_published" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text", "p_is_published" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."ai_interactions" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."ai_interactions" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."ai_interactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_interactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."blocks" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."blocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_attempts" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."exercise_attempts" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."exercise_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercise_attempts_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_progress" TO "service_role";
GRANT SELECT ON TABLE "public"."lesson_progress" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."lesson_progress_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lesson_progress_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lessons" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."lessons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lessons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."modules" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."modules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."modules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("profile_description") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."roles" TO "service_role";
GRANT SELECT ON TABLE "public"."roles" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







