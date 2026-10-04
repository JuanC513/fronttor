-- ============================================================================
-- Lo que el estudiante ha usado el tutor, para su panel de Inicio.
--
-- DEPENDE de 20260818120000 (ai_interactions) y de 20260926130000, que le anadio
-- la columna `status`.
--
-- EL PROBLEMA
-- El panel de Inicio no dice nada del tutor de IA, que es lo que distingue a
-- esta aplicacion de una plataforma de cursos. Y no lo dice porque no puede: el
-- estudiante NO PUEDE LEER NI SUS PROPIAS INTERACCIONES. ai_interactions solo
-- tiene ai_interactions_insert_own y ai_interactions_select_teacher, asi que una
-- cuenta de solo estudiante ve cero filas -comprobado-.
--
-- POR QUE UNA FUNCION Y NO UNA POLICY DE LECTURA
-- Lo directo seria anadir ai_interactions_select_own. No conviene: la tabla
-- guarda `prompt`, y el prompt lleva dentro las reglas del sistema, incluidas
-- las defensas contra inyeccion que estan escritas en _shared/. Ensenarselas al
-- estudiante es justo lo que permite fabricar una inyeccion a medida.
--
-- Acotarlo con permisos de columna tampoco sirve, porque los grants son POR ROL:
-- esconder `prompt` del estudiante lo esconderia tambien del profesor, que lo
-- necesita para revisar los fallos del modelo. Es el mismo callejon que ya
-- aparecio en 20260926120000 con la solucion de los ejercicios, y la salida es
-- la misma: una funcion security definer que devuelve SOLO el agregado, sin dar
-- acceso a ninguna fila.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. El indice
--
-- ai_interactions es la tabla que mas crece del esquema -una fila por cada
-- interaccion de cada usuario, y las pruebas con usuarios multiplican eso-, y
-- hasta ahora solo tenia indices por created_at. La consulta de abajo filtra por
-- user_id y ordena por created_at, asi que el indice compuesto sirve para las
-- dos cosas a la vez.
-- ----------------------------------------------------------------------------

create index if not exists ai_interactions_user_recent_idx
  on public.ai_interactions (user_id, created_at desc);


-- ----------------------------------------------------------------------------
-- 2. El agregado
--
-- QUE CUENTA Y QUE NO
--   * `content` queda fuera a proposito: esa es la generacion de contenido del
--     PROFESOR, no el uso del tutor por parte del estudiante. Contarla haria que
--     una cuenta con los dos roles se viera un numero que no le corresponde.
--   * Solo `status = 'ok'`: una llamada que fallo no es una consulta que el
--     estudiante haya hecho, y contarla inflaria la cifra con errores nuestros.
--
-- Como es security definer la RLS no se aplica, de modo que el filtro por
-- auth.uid() no es una defensa mas: es la unica. Mismo motivo que en
-- get_student_context().
-- ----------------------------------------------------------------------------

create or replace function public.get_my_tutor_activity()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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

comment on function public.get_my_tutor_activity() is
  'Cuantas veces ha usado el tutor el usuario actual, y de que iba la ultima. Solo el agregado: no da acceso a las filas, que llevan el prompt.';


-- ----------------------------------------------------------------------------
-- 3. Permisos
--
-- Desde 20260928120000 las funciones nuevas nacen sin EXECUTE para nadie, asi
-- que el grant no es ceremonia: sin el, la RPC responderia 42501.
-- ----------------------------------------------------------------------------

revoke all on function public.get_my_tutor_activity() from public, anon;
grant execute on function public.get_my_tutor_activity() to authenticated;

notify pgrst, 'reload schema';
