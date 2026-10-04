-- ============================================================================
-- Separar la practica del estudiante de la autoria del profesor.
--
-- DEPENDE de 20260818120000 (ai_interactions) y de 20261001120000, cuya funcion
-- get_my_tutor_activity() se reemplaza aqui.
--
-- EL PROBLEMA
-- `generate-exercise` -el profesor redactando un ejercicio- y `generate-practice`
-- -el estudiante pidiendo algo con lo que practicar- registraban las dos el
-- MISMO `kind = 'exercise'`. Y get_my_tutor_activity() cuenta ese kind como
-- "practicas generadas" del usuario actual.
--
-- Consecuencia: una cuenta con los dos roles ve en su panel de Inicio, como
-- practicas suyas, cada parte de cada ejercicio que ha redactado. Con 44
-- ejercicios por delante serian 176 practicas que nadie hizo.
--
-- Es exactamente lo que 20261001120000 evito dejando `content` fuera del
-- recuento -"contarla haria que una cuenta con los dos roles se viera un numero
-- que no le corresponde"-; aquel razonamiento valia igual para esta, pero
-- `generate-exercise` compartia kind con la practica y se colo.
--
-- POR QUE SE RENOMBRA LA DEL ESTUDIANTE Y NO LA DEL PROFESOR
-- Porque asi no hay que tocar una sola fila existente. A dia de hoy las 32 filas
-- con kind = 'exercise' son TODAS del profesor y ninguna de un estudiante
-- -comprobado antes de escribir esto-. Si 'exercise' pasa a significar "el
-- profesor redacto un ejercicio", el historico ya es correcto por si solo, y lo
-- que nace con nombre nuevo es la practica, que no tiene pasado que arreglar.
--
-- Al reves -dejar 'exercise' para el estudiante y crear un kind de autoria-
-- habria exigido reclasificar las 32 a mano, distinguiendolas por heuristicas
-- sobre el prompt. Mas trabajo y menos fiable, para el mismo resultado.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. El nuevo valor admitido
--
-- El check se recrea entero porque Postgres no sabe anadir un valor a un
-- CHECK ya existente. Ninguna fila actual queda fuera: solo se amplia.
-- ----------------------------------------------------------------------------

alter table public.ai_interactions
  drop constraint if exists ai_interactions_kind_check;

alter table public.ai_interactions
  add constraint ai_interactions_kind_check
  check (kind in ('question', 'feedback', 'content', 'exercise', 'practice'));

comment on column public.ai_interactions.kind is
  'Que se le pidio al modelo. Del estudiante: question, feedback, practice. Del profesor: content, exercise.';


-- ----------------------------------------------------------------------------
-- 2. El recuento, contando lo que de verdad hizo el estudiante
--
-- Identica a la de 20261001120000 salvo el kind de 'practicas'. Se reescribe
-- completa y no con un ALTER porque una funcion sql no se parchea por partes, y
-- dejarla a medias aqui seria peor que repetirla.
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
      -- `content` y `exercise` quedan fuera: son las dos formas de generar
      -- material del curso, trabajo del profesor y no uso del tutor.
      and kind in ('question', 'feedback', 'practice')
  )
  select jsonb_build_object(
    'preguntas', (select count(*) from mias where kind = 'question'),
    'pistas',    (select count(*) from mias where kind = 'feedback'),
    'practicas', (select count(*) from mias where kind = 'practice'),

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

revoke all on function public.get_my_tutor_activity() from public, anon;
grant execute on function public.get_my_tutor_activity() to authenticated;

notify pgrst, 'reload schema';
