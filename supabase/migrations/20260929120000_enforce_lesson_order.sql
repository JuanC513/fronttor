-- ============================================================================
-- El recorrido, impuesto por la base y no por la vista.
--
-- DEPENDE de 20260818120000 (lesson_progress, exercise_attempts), de
-- 20260830120000 (is_published y la version vigente de mark_lesson_viewed) y de
-- 20260922120000 (la version vigente de submit_exercise_attempt).
--
-- EL PROBLEMA
-- El desbloqueo del recorrido vive SOLO en TypeScript -learning-progress.ts-,
-- asi que es una comodidad de interfaz y no una barrera. Escribiendo a mano la
-- URL de un subtema bloqueado se entra, y la pagina llama a mark_lesson_viewed,
-- que registra la visita sin preguntar nada. Con eso el candado se cae solo:
-- entrando y saliendo por URL se abre el curso entero.
--
-- HAY DOS PUERTAS, NO UNA
-- mark_lesson_viewed no es la unica que crea filas de lesson_progress;
-- submit_exercise_attempt tambien, y esa es la mas ancha porque solo comprueba
-- que el ejercicio exista -y `passed` lo manda el cliente-. Cerrar una sola no
-- serviria de nada: bastaria con enviar un intento a cualquier ejercicio
-- publicado para crear la fila y avanzar la cadena.
--
-- LO QUE SE CONSIGUE, Y LO QUE NO
-- Ninguna fila de progreso puede nacer fuera de orden: el ORDEN del recorrido
-- queda impuesto aqui. Lo que esto no hace es validar el merito de cada paso,
-- porque `passed` sigue viniendo del cliente; eso es la limitacion que ya
-- documenta exercise-attempt-model.ts y exige que la Edge Function escriba con
-- service_role.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. El guardia
--
-- Replica la regla de lessonAvailability() en learning-progress.ts, cuyos tests
-- son la especificacion de esto:
--
--   * DENTRO de un tema, el contenido de un subtema se abre en cuanto se ha
--     ABIERTO el anterior. Leer no deberia quedar detenido por un ejercicio
--     atascado.
--   * ENTRE temas la regla es una sola y es dura: el primer subtema de un tema
--     no se abre hasta que TODOS los subtemas del tema anterior estan
--     completados. Sin esto el candado no exigia nada mas que clics en orden.
--
-- QUE CUENTA COMO "CONSUMIBLE"
-- El mismo filtro que getLearningTree() en module-service.ts: tema publicado,
-- subtema publicado y al menos un bloque publicado. Tiene que coincidir o las
-- dos implementaciones de la regla discrepan, y entonces el estudiante ve
-- abierto lo que la base le niega.
--
-- POR QUE UNA SOLA SENTENCIA
-- El CTE `consumibles` se referencia tres veces. Eso es lo que evita repetirlo o
-- sacarlo a una vista, que seria un objeto mas al que vigilarle los permisos.
--
-- POR QUE security definer
-- lesson_progress tiene DOS policies de lectura -_select_own y _select_teacher-,
-- asi que una cuenta con doble rol veria el progreso de todos y el guardia
-- responderia por el avance de cualquiera. Al ser security definer la RLS no se
-- aplica, de modo que el filtro por auth.uid() no es una defensa mas: es la
-- unica. Es el mismo motivo que ya obligo a filtrar a mano en
-- get_student_context().
--
-- TRES VALORES, TRES SIGNIFICADOS
--   true  -> alcanzable
--   false -> es parte del recorrido, pero todavia no se llega
--   NULL  -> no es parte del recorrido: sin publicar, o sin bloques publicados.
--            Son cero filas en `objetivo`, y los dos llamadores lo tratan
--            distinto a proposito.
-- ----------------------------------------------------------------------------

create or replace function public.lesson_is_reachable(p_lesson_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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

comment on function public.lesson_is_reachable(integer) is
  'Si el usuario actual puede abrir ese subtema. NULL si el subtema no es parte del recorrido. Replica lessonAvailability() de learning-progress.ts.';


-- Desde 20260928120000 las funciones nuevas nacen sin EXECUTE para nadie, asi
-- que este grant no es ceremonia: sin el, la RPC responderia 42501. Se concede a
-- authenticated porque el guard de la ruta la llama por RPC.
revoke all on function public.lesson_is_reachable(integer) from public, anon;
grant execute on function public.lesson_is_reachable(integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 2. La primera puerta: abrir un subtema
--
-- El guardia SUSTITUYE la comprobacion de is_published que tenia esta funcion,
-- porque ya la cubre. Cambia un caso de borde: un subtema publicado pero SIN
-- bloques publicados antes se registraba y ahora no. Es lo correcto, porque el
-- cliente nunca lo muestra -orderedLessons lo descarta- y una fila de progreso
-- sobre algo que no se puede leer no significa nada.
--
-- El NULL sale en silencio, igual que ya hacia con lo no publicado: no es un
-- error del estudiante, sino contenido que no deberia haber alcanzado. El false
-- si levanta error, y la diferencia importa: un false significa que las dos
-- implementaciones de la regla discrepan o que alguien salto por URL, y las dos
-- cosas conviene que se oigan. La pagina ya recoge ese fallo sin interrumpir la
-- lectura.
-- ----------------------------------------------------------------------------

create or replace function public.mark_lesson_viewed(p_lesson_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
$function$;

revoke all on function public.mark_lesson_viewed(integer) from public, anon;
grant execute on function public.mark_lesson_viewed(integer) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. La segunda puerta: enviar un intento
--
-- Aqui el NULL tambien se rechaza, y no por descuido: anotar una visita es
-- accesorio y el silencio es mas amable, pero registrar un intento es justo lo
-- que el estudiante pidio, asi que negarse tiene que decirse.
--
-- COMPRUEBA EL CONTENIDO, NO LOS EJERCICIOS
-- El cliente es mas estricto con los ejercicios -exige el subtema anterior
-- completado-, y aqui a proposito no. Lo que hay que impedir es que nazca una
-- fila de progreso fuera de orden, y eso lo gobierna la disponibilidad del
-- CONTENIDO: si el subtema es alcanzable, el estudiante ya podria tener esa fila
-- con solo abrirlo. Usar la regla de los ejercicios no anadiria ninguna
-- proteccion y si podria rechazar un caso legitimo, como un ejercicio anadido a
-- un subtema que ya estaba completado. La regla fina se queda en la vista, que es
-- donde es pedagogica y no una barrera.
-- ----------------------------------------------------------------------------

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
$function$;

revoke all on function public.submit_exercise_attempt(
  integer, text, text, text, boolean, jsonb
) from public, anon;

grant execute on function public.submit_exercise_attempt(
  integer, text, text, text, boolean, jsonb
) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Cache de esquema de PostgREST
--
-- lesson_is_reachable tiene que aparecer en /rpc para que el guard de la ruta
-- pueda llamarla.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
