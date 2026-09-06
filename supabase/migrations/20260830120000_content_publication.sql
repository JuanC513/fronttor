-- ============================================================================
-- Publicacion del contenido.
--
-- El contenido del curso se publica de forma explicita: cada tema, subtema,
-- bloque y ejercicio lleva una marca `is_published` que separa lo que el
-- estudiante ve de lo que todavia se esta preparando.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea la tabla
-- `exercises` y las funciones de progreso que aqui se redefinen.
--
-- El modelo tiene dos niveles:
--
--   * `is_published` es lo que el administrador DECLARA. Es un dato.
--   * Que algo se VEA es una consecuencia que se calcula:
--
--       bloque visible    <=> bloque.is_published
--       ejercicio visible <=> ejercicio.is_published
--       subtema visible   <=> subtema.is_published AND tiene >=1 bloque visible
--       tema visible      <=> tema.is_published    AND tiene >=1 subtema visible
--
-- Un subtema depende de sus BLOQUES y no de sus ejercicios: un subtema que solo
-- tuviera ejercicios no tendria nada que ensenar.
--
-- Despublicar un tema NO escribe nada en sus subtemas; solo deja de mostrarlos
-- por derivacion. Asi, volver a publicarlo restituye exactamente la
-- configuracion anterior en lugar de perderla.
--
-- `order` sigue siendo disposicion y no visibilidad: un borrador conserva su
-- posicion entre sus hermanos y las funciones de reordenar no cambian.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La columna
--
-- El valor por defecto es falso, igual que la regla de negocio: todo nace en
-- borrador, de modo que ninguna ruta de insercion pueda publicar por descuido.
--
-- El contenido que ya existia estaba visible, asi que se publica en el mismo
-- paso. Esa carga inicial va dentro de la comprobacion de existencia de la
-- columna a proposito: fuera de ella, reejecutar el archivo publicaria de golpe
-- todos los borradores que hubiera en ese momento.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'modules'
      and column_name = 'is_published'
  ) then
    alter table public.modules add column is_published boolean not null default false;
    update public.modules set is_published = true;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lessons'
      and column_name = 'is_published'
  ) then
    alter table public.lessons add column is_published boolean not null default false;
    update public.lessons set is_published = true;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'blocks'
      and column_name = 'is_published'
  ) then
    alter table public.blocks add column is_published boolean not null default false;
    update public.blocks set is_published = true;
  end if;
end $$;

-- Sin carga inicial: los ejercicios nacen con esta columna, no hay nada previo
-- que preservar.
alter table public.exercises
  add column if not exists is_published boolean not null default false;

-- Sin indices parciales sobre is_published: con este volumen de filas el
-- planificador recorre la tabla igual de rapido. Se anaden el dia que se note.


-- ----------------------------------------------------------------------------
-- 2. Progreso del estudiante
--
-- Un subtema se completa cuando el estudiante aprueba todos sus ejercicios, y
-- solo cuentan los que puede ver: un ejercicio en borrador que entrara en el
-- total dejaria el subtema imposible de completar, porque no hay forma de
-- intentar un ejercicio que no se muestra.
--
-- Al despublicar un ejercicio, este sale a la vez del total y de los aprobados,
-- asi que la cuenta sigue cuadrando.
-- ----------------------------------------------------------------------------

create or replace function public.recompute_lesson_progress(
  p_user_id uuid,
  p_lesson_id integer
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;


-- Se llama al abrir un subtema. Registra que el estudiante lo empezo y resuelve
-- tres situaciones:
--   * sin ejercicios publicados -> completed con exercises_at_completion = 0
--   * todos ya aprobados        -> completed
--   * cualquier otra            -> in_progress
--
-- El segundo caso importa cuando el conjunto de ejercicios cambia: si dejan de
-- faltarle ejercicios por una edicion del contenido, el subtema se completa al
-- volver a entrar, sin necesidad de que el estudiante envie nada mas.
--
-- Sobre un subtema sin publicar no registra nada: el progreso describe el
-- recorrido por el contenido visible, y una fila de progreso sobre material
-- oculto no significa nada. Sale en silencio porque no es un error del
-- estudiante, sino contenido que no deberia haber alcanzado.
create or replace function public.mark_lesson_viewed(p_lesson_id integer)
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

  IF NOT EXISTS (
    SELECT 1 FROM lessons WHERE id = p_lesson_id AND is_published
  ) THEN
    RETURN;
  END IF;

  INSERT INTO lesson_progress (user_id, lesson_id, status)
  VALUES (v_user_id, p_lesson_id, 'in_progress')
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  PERFORM recompute_lesson_progress(v_user_id, p_lesson_id);
END;
$function$;


-- ----------------------------------------------------------------------------
-- 3. RPC de administracion del contenido
--
-- Cada funcion se suelta antes de volver a crearse. No es limpieza opcional:
-- `create or replace` con un parametro de mas no reemplaza nada, crea una
-- SOBRECARGA. Con las dos firmas vivas, PostgREST no puede decidir cual invocar
-- y responde "Could not choose the best candidate function" en cada llamada.
--
-- Al soltar una funcion se pierden sus permisos, de ahi el grant que acompana a
-- cada una.
--
-- En las de insercion el parametro lleva un valor por defecto, de modo que la
-- propia RPC respete la regla aunque el llamador lo omita. En las de
-- actualizacion es obligatorio: el formulario siempre conoce el valor.
-- ----------------------------------------------------------------------------

-- Temas
drop function if exists public.insert_module(text);
create or replace function public.insert_module(
  p_name         text,
  p_is_published boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  INSERT INTO modules (name, "order", is_published)
  VALUES (
    p_name,
    COALESCE((SELECT MAX("order") FROM modules), 0) + 1,
    p_is_published
  );
END;
$function$;

grant execute on function public.insert_module(text, boolean) to authenticated;

drop function if exists public.update_module(integer, text);
create or replace function public.update_module(
  p_id           integer,
  p_name         text,
  p_is_published boolean
)
returns void
language plpgsql
as $function$
BEGIN
  UPDATE modules
  SET name         = p_name,
      is_published = p_is_published
  WHERE id = p_id;
END;
$function$;

grant execute on function public.update_module(integer, text, boolean) to authenticated;

-- Subtemas
drop function if exists public.insert_lesson(text, integer);
create or replace function public.insert_lesson(
  p_name         text,
  p_module_id    integer,
  p_is_published boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  INSERT INTO lessons (name, module_id, "order", is_published)
  VALUES (
    p_name,
    p_module_id,
    COALESCE((SELECT MAX("order") FROM lessons WHERE module_id = p_module_id), 0) + 1,
    p_is_published
  );
END;
$function$;

grant execute on function public.insert_lesson(text, integer, boolean) to authenticated;

drop function if exists public.update_lesson(integer, text, integer);
create or replace function public.update_lesson(
  p_id           integer,
  p_name         text,
  p_module_id    integer,
  p_is_published boolean
)
returns void
language plpgsql
as $function$
BEGIN
  UPDATE lessons
  SET name         = p_name,
      module_id    = p_module_id,
      is_published = p_is_published
  WHERE id = p_id;
END;
$function$;

grant execute on function public.update_lesson(integer, text, integer, boolean) to authenticated;

-- Bloques
drop function if exists public.insert_block(text, text, integer);
create or replace function public.insert_block(
  p_name         text,
  p_content      text,
  p_lesson_id    integer,
  p_is_published boolean DEFAULT false
)
returns void
language plpgsql
as $function$
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
$function$;

grant execute on function public.insert_block(text, text, integer, boolean) to authenticated;

drop function if exists public.update_block(integer, text, text, integer);
create or replace function public.update_block(
  p_id           integer,
  p_name         text,
  p_content      text,
  p_lesson_id    integer,
  p_is_published boolean
)
returns void
language plpgsql
as $function$
BEGIN
  UPDATE blocks
  SET name         = p_name,
      content      = p_content,
      lesson_id    = p_lesson_id,
      is_published = p_is_published
  WHERE id = p_id;
END;
$function$;

grant execute on function public.update_block(integer, text, text, integer, boolean) to authenticated;

-- Ejercicios
drop function if exists public.insert_exercise(
  integer, text, text, text, text, text, text, jsonb, text
);
create or replace function public.insert_exercise(
  p_lesson_id    integer,
  p_name         text,
  p_statement    text,
  p_difficulty   text    DEFAULT 'media',
  p_starter_html text    DEFAULT '',
  p_starter_css  text    DEFAULT '',
  p_starter_js   text    DEFAULT '',
  p_criteria     jsonb   DEFAULT '[]'::jsonb,
  p_source       text    DEFAULT 'manual',
  p_is_published boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  INSERT INTO exercises (
    lesson_id, name, statement, difficulty,
    starter_html, starter_css, starter_js, criteria, source, is_published, "order"
  )
  VALUES (
    p_lesson_id,
    p_name,
    p_statement,
    p_difficulty,
    p_starter_html,
    p_starter_css,
    p_starter_js,
    p_criteria,
    p_source,
    p_is_published,
    COALESCE((SELECT MAX("order") FROM exercises WHERE lesson_id = p_lesson_id), 0) + 1
  );
END;
$function$;

grant execute on function public.insert_exercise(
  integer, text, text, text, text, text, text, jsonb, text, boolean
) to authenticated;

drop function if exists public.update_exercise(
  integer, text, text, integer, text, text, text, text, jsonb, text
);
create or replace function public.update_exercise(
  p_id           integer,
  p_name         text,
  p_statement    text,
  p_lesson_id    integer,
  p_difficulty   text    DEFAULT 'media',
  p_starter_html text    DEFAULT '',
  p_starter_css  text    DEFAULT '',
  p_starter_js   text    DEFAULT '',
  p_criteria     jsonb   DEFAULT '[]'::jsonb,
  p_source       text    DEFAULT 'manual',
  p_is_published boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  UPDATE exercises
  SET name         = p_name,
      statement    = p_statement,
      lesson_id    = p_lesson_id,
      difficulty   = p_difficulty,
      starter_html = p_starter_html,
      starter_css  = p_starter_css,
      starter_js   = p_starter_js,
      criteria     = p_criteria,
      source       = p_source,
      is_published = p_is_published
  WHERE id = p_id;
END;
$function$;

grant execute on function public.update_exercise(
  integer, text, text, integer, text, text, text, text, jsonb, text, boolean
) to authenticated;


-- ============================================================================
-- Comprobacion
--
--   -- 1. La columna existe en las cuatro tablas y lo que ya habia quedo visible
--   select table_name, column_default
--   from information_schema.columns
--   where table_schema = 'public' and column_name = 'is_published';
--
--   select count(*) filter (where is_published) as publicados, count(*) as total
--   from modules;
--
--   -- 2. Ninguna RPC quedo duplicada por una sobrecarga
--   select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('insert_module','update_module','insert_lesson','update_lesson',
--                     'insert_block','update_block','insert_exercise','update_exercise')
--   order by proname;
--   -- Debe devolver exactamente ocho filas, una por funcion.
--
--   -- 3. Un ejercicio en borrador no bloquea el completado del subtema
--   select insert_exercise(<lesson_id>, 'borrador', 'x');  -- nace sin publicar
--   select mark_lesson_viewed(<lesson_id>);                -- con sesion de estudiante
--   select status from lesson_progress
--   where lesson_id = <lesson_id> and user_id = auth.uid();
--   -- Debe decir completed.
-- ============================================================================
