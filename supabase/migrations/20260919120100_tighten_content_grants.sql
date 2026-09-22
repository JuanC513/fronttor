-- ============================================================================
-- Recorte de permisos sobre las tablas de contenido y de practica.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql y de
-- 20260818130000_content_and_profile_policies.sql, que son las que declaran las
-- policies que aqui se toman como referencia.
--
-- Continua lo que hace 20260919120000_tighten_identity_grants.sql, que cerro
-- profiles, roles y user_roles. Estas siete tablas conservaban los privilegios
-- por defecto del esquema public de Supabase, intactos:
--
--   modules, lessons, blocks, exercises        GRANT ALL a authenticated Y a anon
--   exercise_attempts, lesson_progress,
--   ai_interactions                            GRANT ALL a authenticated
--
-- Su RLS esta bien puesta y es la que de verdad decide quien lee y quien
-- escribe, asi que por la API se comportan correctamente. Lo que sobra es lo que
-- la RLS no puede ver: TRUNCATE no pasa por ella, y en las cuatro de contenido
-- el permiso alcanza ademas a anon, que es la clave publicable que viaja en el
-- bundle de la aplicacion.
--
--
-- LA REGLA
--
-- Se revoca todo y se concede EXACTAMENTE LO QUE LAS POLICIES CONTEMPLAN. Si una
-- tabla no tiene policy de update, tampoco necesita el permiso de update: seria
-- un permiso que nunca llega a ejercerse y que solo existe para que algun dia
-- alguien lo aproveche por una via que hoy no imaginamos.
--
-- Esto exige cuidado, y por eso va en su propio archivo: LAS RPC DE CONTENIDO NO
-- SON SECURITY DEFINER. insert_module, update_block, delete_lesson y las demas
-- se ejecutan con los privilegios de quien llama, precisamente para que la RLS
-- sea el unico lugar donde vive la autorizacion. Quitarle a authenticated el
-- insert sobre modules no dejaria la tabla "mas segura": dejaria el panel de
-- administracion sin poder crear nada.
--
-- Las de progreso son al reves: submit_exercise_attempt y mark_lesson_viewed SI
-- son security definer, asi que escriben por su cuenta y no necesitan que quien
-- llama tenga permiso sobre la tabla.
--
-- Es seguro reejecutarlo cuantas veces haga falta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Contenido: modules, lessons, blocks, exercises
--
-- Las cuatro tienen el mismo juego de policies: lectura para cualquier
-- autenticado, y escritura restringida a is_admin() en insert, update y delete.
-- Los cuatro permisos hacen falta porque las RPC corren como el invocador.
--
-- La diferencia con lo que habia no es la escritura, que la RLS ya limitaba
-- bien, sino TRUNCATE y el acceso de anon.
-- ----------------------------------------------------------------------------

revoke all on table public.modules   from anon;
revoke all on table public.lessons   from anon;
revoke all on table public.blocks    from anon;
revoke all on table public.exercises from anon;

revoke all on table public.modules   from authenticated;
revoke all on table public.lessons   from authenticated;
revoke all on table public.blocks    from authenticated;
revoke all on table public.exercises from authenticated;

grant select, insert, update, delete on table public.modules   to authenticated;
grant select, insert, update, delete on table public.lessons   to authenticated;
grant select, insert, update, delete on table public.blocks    to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;


-- ----------------------------------------------------------------------------
-- 2. exercise_attempts
--
-- Policies: select de lo propio, select de todo para admin, insert de lo propio.
-- No hay update ni delete, y es deliberado: un intento es un hecho historico y
-- no se reescribe.
--
-- El insert se concede aunque hoy nadie lo use directamente —la aplicacion pasa
-- por submit_exercise_attempt, que es security definer—, porque la policy
-- attempts_insert_own lo contempla. Dejarla sin permiso la convertiria en letra
-- muerta, y el dia que algo inserte directo fallaria con un error de permisos
-- que no explica nada, en vez de comportarse como la policy promete.
-- ----------------------------------------------------------------------------

revoke all on table public.exercise_attempts from anon;
revoke all on table public.exercise_attempts from authenticated;

grant select, insert on table public.exercise_attempts to authenticated;


-- ----------------------------------------------------------------------------
-- 3. lesson_progress
--
-- Solo lectura. No tiene ninguna policy de escritura porque el progreso no lo
-- declara el estudiante: lo calcula recompute_lesson_progress, a la que solo
-- llegan mark_lesson_viewed y submit_exercise_attempt, las dos security definer.
--
-- Que authenticated no pueda escribir aqui es justo lo que impide que alguien se
-- marque un subtema como completado sin haberlo hecho.
-- ----------------------------------------------------------------------------

revoke all on table public.lesson_progress from anon;
revoke all on table public.lesson_progress from authenticated;

grant select on table public.lesson_progress to authenticated;


-- ----------------------------------------------------------------------------
-- 4. ai_interactions
--
-- Policies: insert de lo propio, y select solo para admin. Asimetrico a
-- proposito: el registro se escribe al usar la IA, pero leerlo es analitica del
-- administrador, no algo que cada estudiante consulte.
-- ----------------------------------------------------------------------------

revoke all on table public.ai_interactions from anon;
revoke all on table public.ai_interactions from authenticated;

grant select, insert on table public.ai_interactions to authenticated;


-- ============================================================================
-- Lo que este archivo NO toca, y no es un descuido
--
-- LAS SECUENCIAS. modules, lessons y blocks generan su id con serial, es decir
-- con un default nextval() sobre una secuencia aparte. Como sus RPC corren con
-- los privilegios de quien llama, authenticated necesita seguir teniendo USAGE
-- sobre esas secuencias o ningun insert funcionara. Los privilegios por defecto
-- ya se lo dan y aqui se dejan intactos a proposito.
--
-- (exercises, exercise_attempts, lesson_progress y ai_interactions usan GENERATED
-- AS IDENTITY, que no necesita permiso de secuencia. La diferencia es historica,
-- no intencionada.)
--
-- service_role conserva GRANT ALL en todas. Es el rol de la clave secreta del
-- servidor, que por definicion se salta la RLS; recortarlo no anadiria nada.
--
--
-- Comprobacion
--
-- Ninguna fila con anon, y para authenticated exactamente esto:
--
--   select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated')
--   group by 1, 2 order by 1, 2;
--
--   ai_interactions     INSERT, SELECT
--   blocks              DELETE, INSERT, SELECT, UPDATE
--   exercise_attempts   INSERT, SELECT
--   exercises           DELETE, INSERT, SELECT, UPDATE
--   lesson_progress     SELECT
--   lessons             DELETE, INSERT, SELECT, UPDATE
--   modules             DELETE, INSERT, SELECT, UPDATE
--   profiles            SELECT, UPDATE
--   roles               SELECT
--   user_roles          SELECT
--
-- Despues, con la aplicacion y sesion de administrador, hay que ejercer el panel
-- COMPLETO, que es lo unico que prueba de verdad que no se quito nada:
--
--   crear, editar, reordenar y borrar un tema, un subtema y un bloque
--   crear, editar y borrar un ejercicio
--
-- Y con sesion de estudiante, que el recorrido de aprendizaje siga leyendose.
-- ============================================================================
