-- ============================================================================
-- Ejercicios, intentos y progreso del estudiante.
--
-- Define el dominio de practica: los ejercicios de cada subtema, los envios del
-- estudiante y el avance que se deriva de ellos. Incluye tambien el registro de
-- interacciones con la IA, que es la base para analizar el uso del sistema.
--
-- Convenciones del esquema:
--   * PK y FK de tipo `integer`. El tipo importa: una FK integer -> bigint no se
--     puede crear.
--   * `name` como varchar(255).
--   * `"order" integer not null default 0` con restriccion unica por padre, para
--     que dos hermanos no puedan ocupar la misma posicion.
--   * Las RPC devuelven `void` y reciben parametros `integer`; el borrado
--     renumera el `order` y el reordenamiento se hace en dos pasadas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------------------

-- La tabla se recrea desde cero para que el archivo sea reaplicable.
-- ATENCION: reaplicar esta migracion sobre una base con ejercicios cargados los
-- borra. En ese caso hay que ejecutar solo las secciones siguientes.
drop table if exists public.exercises cascade;

create table public.exercises (
  id           integer generated always as identity primary key,
  lesson_id    integer not null references public.lessons (id) on delete cascade,
  name         character varying(255) not null,
  -- Markdown; se renderiza con MarkdownRenderer, igual que blocks.content.
  statement    text not null,
  difficulty   text not null default 'media'
               check (difficulty in ('facil', 'media', 'dificil')),
  -- El codigo inicial no es solo comodidad para el estudiante: da ids y clases
  -- conocidos contra los cuales los criterios pueden hacer aserciones fiables.
  starter_html text not null default '',
  starter_css  text not null default '',
  starter_js   text not null default '',
  -- Criterios declarativos con los que se valida el envio. La forma de cada
  -- criterio esta documentada en exercise-criterion-model.ts.
  criteria     jsonb not null default '[]'::jsonb
               check (jsonb_typeof(criteria) = 'array'),
  -- Distingue los ejercicios escritos a mano de los generados con IA.
  source       text not null default 'manual'
               check (source in ('manual', 'ia')),
  "order"      integer not null default 0,
  created_at   timestamptz not null default now(),
  -- Es la razon por la que reorder_exercises necesita dos pasadas.
  constraint exercises_order_per_lesson_unique unique (lesson_id, "order")
);

create index exercises_lesson_id_idx on public.exercises (lesson_id);


-- Se guardan todos los intentos, no solo el ultimo: es lo que permite analizar
-- como progresa cada estudiante y ajustar la dificultad segun su desempeno.
create table if not exists public.exercise_attempts (
  id             integer generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  exercise_id    integer not null references public.exercises (id) on delete cascade,
  submitted_html text not null default '',
  submitted_css  text not null default '',
  submitted_js   text not null default '',
  passed         boolean not null,
  -- Resultado por criterio: [{ description, passed }]
  results        jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(results) = 'array'),
  -- Retroalimentacion de la IA sobre este intento. Opcional.
  feedback       text,
  created_at     timestamptz not null default now()
);

create index if not exists exercise_attempts_user_exercise_idx
  on public.exercise_attempts (user_id, exercise_id);


create table if not exists public.lesson_progress (
  id                      integer generated always as identity primary key,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  lesson_id               integer not null references public.lessons (id) on delete cascade,
  status                  text not null default 'in_progress'
                          check (status in ('in_progress', 'completed')),
  -- Cuantos ejercicios tenia el subtema al completarlo. Hace permanente el
  -- completado sin perder informacion: comparando con el total actual se puede
  -- avisar "hay N ejercicios nuevos" sin volver a bloquear el subtema.
  exercises_at_completion integer,
  completed_at            timestamptz,
  updated_at              timestamptz not null default now(),
  constraint lesson_progress_user_lesson_unique unique (user_id, lesson_id)
);


create table if not exists public.ai_interactions (
  id          integer generated always as identity primary key,
  -- Las tres FK usan set null a proposito: borrar un usuario o un ejercicio no
  -- debe borrar el registro de que la interaccion ocurrio.
  user_id     uuid references auth.users (id) on delete set null,
  kind        text not null
              check (kind in ('question', 'feedback', 'content', 'exercise')),
  lesson_id   integer references public.lessons (id) on delete set null,
  exercise_id integer references public.exercises (id) on delete set null,
  model       text,
  prompt      text,
  response    text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_interactions_created_at_idx
  on public.ai_interactions (created_at);


-- ----------------------------------------------------------------------------
-- 2. Helper de rol
--
-- El rol de un usuario vive en el join profiles.role_id -> roles.name. Esta
-- funcion lo encapsula para que las policies, el frontend
-- (AuthService.loadProfile) y las Edge Functions (requireAdmin) compartan un
-- unico criterio de que significa ser admin.
--
-- security definer es necesario para leer profiles sin depender de la RLS de
-- esa tabla, cuya policy de SELECT solo deja ver la fila propia.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from profiles p
    join roles r on r.id = p.role_id
    where p.user_id = auth.uid()
      and r.name = 'admin'
  );
$function$;


-- ----------------------------------------------------------------------------
-- 3. Regla de completado
--
-- Un subtema se completa cuando TODOS sus ejercicios tienen al menos un intento
-- aprobado, y una vez completado no vuelve atras: agregar un ejercicio despues
-- no descompleta el subtema de quien ya lo termino.
--
-- Con 0 ejercicios, total = aprobados = 0, asi que un subtema sin practica se
-- completa con solo abrirlo. Es el comportamiento buscado, y sale sin necesidad
-- de un caso especial.
--
-- La comparten las dos RPC de progreso para que la regla viva en un solo lugar.
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
  WHERE lesson_id = p_lesson_id;

  SELECT count(DISTINCT e.id) INTO v_passed
  FROM exercises e
  JOIN exercise_attempts a ON a.exercise_id = e.id
  WHERE e.lesson_id = p_lesson_id
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


-- ----------------------------------------------------------------------------
-- 4. RPC de progreso del estudiante
--
-- Ninguna recibe el id del usuario: lo resuelven con auth.uid() del lado del
-- servidor. Un parametro de usuario dejaria que cualquiera escribiera progreso
-- a nombre de otro, y al ser security definer la RLS no lo frenaria.
-- ----------------------------------------------------------------------------

create or replace function public.submit_exercise_attempt(
  p_exercise_id integer,
  p_html        text,
  p_css         text,
  p_js          text,
  p_passed      boolean,
  p_results     jsonb DEFAULT '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
  v_user_id   uuid := auth.uid();
  v_lesson_id INTEGER;
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
  );

  INSERT INTO lesson_progress (user_id, lesson_id, status)
  VALUES (v_user_id, v_lesson_id, 'in_progress')
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  IF p_passed THEN
    PERFORM recompute_lesson_progress(v_user_id, v_lesson_id);
  END IF;
END;
$function$;


-- Se llama al abrir un subtema. Registra que el estudiante lo empezo y resuelve
-- tres situaciones:
--   * sin ejercicios     -> completed con exercises_at_completion = 0
--   * todos ya aprobados -> completed
--   * cualquier otra     -> in_progress
--
-- El segundo caso importa cuando el conjunto de ejercicios cambia: si dejan de
-- faltarle ejercicios por una edicion del contenido, el subtema se completa al
-- volver a entrar, sin necesidad de que el estudiante envie nada mas.
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

  INSERT INTO lesson_progress (user_id, lesson_id, status)
  VALUES (v_user_id, p_lesson_id, 'in_progress')
  ON CONFLICT (user_id, lesson_id) DO NOTHING;

  PERFORM recompute_lesson_progress(v_user_id, p_lesson_id);
END;
$function$;


-- ----------------------------------------------------------------------------
-- 5. RPC de administracion de ejercicios
--
-- Devuelven void y no son security definer: la RLS de exercises es la que
-- restringe la escritura a admin, asi la autorizacion tiene un solo lugar de
-- verdad. El `order` lo calcula la funcion, nunca el llamador.
-- ----------------------------------------------------------------------------

create or replace function public.insert_exercise(
  p_lesson_id    integer,
  p_name         text,
  p_statement    text,
  p_difficulty   text  DEFAULT 'media',
  p_starter_html text  DEFAULT '',
  p_starter_css  text  DEFAULT '',
  p_starter_js   text  DEFAULT '',
  p_criteria     jsonb DEFAULT '[]'::jsonb,
  p_source       text  DEFAULT 'manual'
)
returns void
language plpgsql
as $function$
BEGIN
  INSERT INTO exercises (
    lesson_id, name, statement, difficulty,
    starter_html, starter_css, starter_js, criteria, source, "order"
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
    COALESCE((SELECT MAX("order") FROM exercises WHERE lesson_id = p_lesson_id), 0) + 1
  );
END;
$function$;


create or replace function public.update_exercise(
  p_id           integer,
  p_name         text,
  p_statement    text,
  p_lesson_id    integer,
  p_difficulty   text  DEFAULT 'media',
  p_starter_html text  DEFAULT '',
  p_starter_css  text  DEFAULT '',
  p_starter_js   text  DEFAULT '',
  p_criteria     jsonb DEFAULT '[]'::jsonb,
  p_source       text  DEFAULT 'manual'
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
      source       = p_source
  WHERE id = p_id;
END;
$function$;


-- Renumera los que quedan para cerrar el hueco, de modo que las posiciones
-- sigan siendo consecutivas.
create or replace function public.delete_exercise(p_id integer)
returns void
language plpgsql
as $function$
DECLARE
  v_order     INTEGER;
  v_lesson_id INTEGER;
BEGIN
  SELECT "order", lesson_id INTO v_order, v_lesson_id FROM exercises WHERE id = p_id;
  DELETE FROM exercises WHERE id = p_id;
  UPDATE exercises SET "order" = "order" - 1
  WHERE lesson_id = v_lesson_id AND "order" > v_order;
END;
$function$;


-- Dos pasadas: la restriccion unica (lesson_id, "order") haria fallar una
-- reasignacion directa, porque a medio camino dos filas compartirian posicion.
-- La primera pasada mueve todo a negativos para liberar el rango y la segunda
-- asigna los valores definitivos.
create or replace function public.reorder_exercises(p_ids integer[])
returns void
language plpgsql
as $function$
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
$function$;


-- ----------------------------------------------------------------------------
-- 6. Politicas de acceso
--
-- El modelo es:
--   * exercises          -> lectura para cualquier autenticado, escritura admin
--   * exercise_attempts  -> cada quien los suyos; el admin puede leerlos todos
--   * lesson_progress    -> lectura del dueno y del admin; escritura solo RPC
--   * ai_interactions    -> cada quien registra lo suyo, solo el admin lee
-- ----------------------------------------------------------------------------

alter table public.exercises         enable row level security;
alter table public.exercise_attempts enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.ai_interactions   enable row level security;

drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated on public.exercises
  for select to authenticated using (true);

drop policy if exists exercises_insert_admin on public.exercises;
create policy exercises_insert_admin on public.exercises
  for insert to authenticated with check (public.is_admin());

drop policy if exists exercises_update_admin on public.exercises;
create policy exercises_update_admin on public.exercises
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists exercises_delete_admin on public.exercises;
create policy exercises_delete_admin on public.exercises
  for delete to authenticated using (public.is_admin());

-- Sin policies de update ni delete a proposito: un intento enviado no se
-- modifica ni se borra, porque es el registro de lo que hizo el estudiante.
drop policy if exists attempts_select_own on public.exercise_attempts;
create policy attempts_select_own on public.exercise_attempts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists attempts_select_admin on public.exercise_attempts;
create policy attempts_select_admin on public.exercise_attempts
  for select to authenticated using (public.is_admin());

drop policy if exists attempts_insert_own on public.exercise_attempts;
create policy attempts_insert_own on public.exercise_attempts
  for insert to authenticated with check (user_id = auth.uid());

-- Sin policies de escritura: el progreso solo lo escriben las RPC security
-- definer, que resuelven el usuario con auth.uid(). Asi nadie puede declararse
-- completado un subtema desde el cliente.
drop policy if exists progress_select_own on public.lesson_progress;
create policy progress_select_own on public.lesson_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists progress_select_admin on public.lesson_progress;
create policy progress_select_admin on public.lesson_progress
  for select to authenticated using (public.is_admin());

drop policy if exists ai_interactions_insert_own on public.ai_interactions;
create policy ai_interactions_insert_own on public.ai_interactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists ai_interactions_select_admin on public.ai_interactions;
create policy ai_interactions_select_admin on public.ai_interactions
  for select to authenticated using (public.is_admin());


-- ----------------------------------------------------------------------------
-- 7. Permisos
--
-- En un proyecto de Supabase con ALTER DEFAULT PRIVILEGES configurado, las
-- tablas y funciones nuevas quedan concedidas a anon, authenticated y
-- service_role al crearse. La RLS es lo que realmente protege, pero se revoca
-- el acceso del rol anonimo de forma explicita: que una tabla con datos
-- personales dependa unicamente de que exista la policy correcta es demasiado
-- fragil.
-- ----------------------------------------------------------------------------

revoke all on table public.exercise_attempts from anon;
revoke all on table public.lesson_progress   from anon;
revoke all on table public.ai_interactions   from anon;

grant select, insert, update, delete on table public.exercises         to authenticated;
grant select, insert                 on table public.exercise_attempts to authenticated;
grant select                         on table public.lesson_progress   to authenticated;
grant select, insert                 on table public.ai_interactions   to authenticated;

revoke all on function public.is_admin() from anon;
revoke all on function public.submit_exercise_attempt(integer, text, text, text, boolean, jsonb) from anon;
revoke all on function public.mark_lesson_viewed(integer) from anon;

-- recompute_lesson_progress es interna: solo la invocan las otras dos RPC. No se
-- concede a nadie porque recibe el id de usuario como parametro y permitiria
-- recalcular el progreso de otra persona.
revoke all on function public.recompute_lesson_progress(uuid, integer) from anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.submit_exercise_attempt(integer, text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.mark_lesson_viewed(integer) to authenticated;

grant execute on function public.insert_exercise(integer, text, text, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.update_exercise(integer, text, text, integer, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.delete_exercise(integer) to authenticated;
grant execute on function public.reorder_exercises(integer[]) to authenticated;
