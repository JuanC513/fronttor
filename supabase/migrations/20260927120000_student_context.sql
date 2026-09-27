-- ============================================================================
-- El tutor puede saber a quien le responde.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql (lesson_progress y
-- exercise_attempts) y de 20260919120000_tighten_identity_grants.sql, que dejo
-- profiles.profile_description como "la unica columna que el usuario puede
-- editar de su propio perfil" -y que hasta hoy no escribia nadie-.
--
-- EL PROBLEMA
-- El sistema escribe mucho sobre el estudiante y no lee NADA al responderle. En
-- las cinco Edge Functions no hay una sola mencion a profiles: los prompts
-- reciben la leccion, la pregunta, el codigo y los criterios, pero nunca QUIEN
-- esta preguntando. El tutor trata igual a quien lleva tres meses y lo aprobo
-- todo que a quien entro ayer.
--
-- DOS FUENTES, Y SOLO UNA NECESITABA COLUMNA
-- Lo derivable -"ha completado 4 subtemas", "lleva 6 intentos fallidos"- ya esta
-- escrito en lesson_progress y exercise_attempts. Copiarlo a un perfil seria
-- duplicar un dato que puede desincronizarse, a cambio de nada: se calcula al
-- leer, que es lo que hace esta funcion.
--
-- Lo no derivable -"vengo de backend", "prefiero ejemplos cortos"- no sale de
-- ninguna consulta. Eso es lo que guarda profile_description.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las dos fuentes en una sola ida y vuelta
--
-- POR QUE FILTRA POR auth.uid() EN CADA SUBCONSULTA
-- No es redundancia con la RLS. lesson_progress y exercise_attempts tienen DOS
-- policies de lectura cada una -_select_own y _select_teacher-, asi que una
-- cuenta con los dos roles -como la que se usa para probar- veria el progreso
-- de todo el mundo y el resumen saldria mezclado. Es el mismo error que ya
-- obligo a filtrar a mano en ExerciseService.getPublishedForStudent.
--
-- Al ser security definer la RLS ni siquiera se aplica, de modo que el filtro
-- explicito no es una defensa mas: es la unica.
--
-- POR QUE UNA RPC Y NO TRES SELECT DESDE LA FUNCION
-- Una ida y vuelta en vez de tres, sobre una llamada a Gemini que ya dura
-- segundos; y la agregacion queda en SQL, que es donde se expresa mejor.
-- ----------------------------------------------------------------------------

create or replace function public.get_student_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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

    -- El campo que mas trabaja: donde lo ha intentado y NUNCA ha aprobado. Es lo
    -- que deja a la pista decir "llevas seis intentos aqui" en vez de tratar
    -- cada envio como si fuera el primero.
    --
    -- `bool_and(not passed)` es "ninguno de sus intentos aprobo". Con un
    -- `where not passed` se colarian los ejercicios que fallo antes de acertar,
    -- que son justo los que YA resolvio.
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
    )
  );
$$;

comment on function public.get_student_context() is
  'Perfil escrito + progreso calculado del usuario actual. Lo consumen los prompts del estudiante.';


-- ----------------------------------------------------------------------------
-- 2. Permisos
--
-- Postgres concede EXECUTE a PUBLIC por defecto en cada funcion nueva, asi que
-- revocar solo a anon no haria nada. Es el mismo descuido que ya se corrigio en
-- 20260922120000 y en 20260926120000.
-- ----------------------------------------------------------------------------

revoke all on function public.get_student_context() from public, anon;
grant execute on function public.get_student_context() to authenticated;

notify pgrst, 'reload schema';
