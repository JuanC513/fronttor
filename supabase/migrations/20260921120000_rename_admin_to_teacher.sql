-- ============================================================================
-- El rol admin pasa a llamarse teacher.
--
-- DEPENDE de 20260918120000_user_roles_many_to_many.sql, que es donde is_admin()
-- pasa a delegar en has_role(), y de 20260818130000_content_and_profile_policies.sql
-- y 20260818120000_exercises_attempts_progress.sql, que declaran las 15 policies.
--
--
-- POR QUE
--
-- En la jerga de sistemas, "administrador" nombra a quien gestiona el sistema
-- -usuarios, permisos, parametros-, no a quien produce el dominio de
-- conocimiento. El rol que hasta aqui se llamaba admin hace lo segundo: escribe
-- temas, subtemas, bloques y ejercicios. El nombre estaba tomado por la
-- responsabilidad equivocada.
--
-- A partir de este archivo, el vocabulario del proyecto es student/teacher. Las
-- migraciones anteriores siguen diciendo "admin" porque en su momento asi se
-- llamaba: son un registro fechado, no la descripcion del presente, y se
-- conservan intactas para que sigan siendo reejecutables tal como estan
-- documentadas.
--
-- El nombre "admin" queda libre para lo que de verdad significa. Si algun dia
-- hace falta un rol de gestion de usuarios, el catalogo roles y has_role() ya lo
-- soportan sin tocar el esquema.
--
--
-- POR QUE RENAME Y NO DROP + CREATE
--
--   drop function public.is_admin() FALLA: hay 15 filas en pg_depend, una por
--   policy. Y el HINT de PostgreSQL sugiere CASCADE, que aqui es destructivo:
--   BORRARIA LAS 15 POLICIES. Con RLS habilitada, quedarse sin policy de
--   escritura no abre la tabla, la CIERRA. El panel entero moriria con "new row
--   violates row-level security policy", un error que no se parece a su causa.
--
--   alter function ... rename to conserva el OID. Una policy no guarda texto
--   sino un arbol de nodos con el funcid, asi que las 15 siguen resolviendo a la
--   misma funcion sin enterarse. Y LA ACL VIAJA CON EL OID: el revoke a anon de
--   20260818120000 sigue vigente. Una funcion creada de cero heredaria los
--   privilegios por defecto de Supabase, que conceden execute a anon, y
--   reabriria en silencio lo que aquella migracion cerro.
--
--
-- EL ORDEN DE ESTE ARCHIVO NO ES LIBRE
--
--   El paso 2 va obligatoriamente antes del 3. Al reves, el create or replace no
--   encuentra is_teacher y CREA UNA FUNCION NUEVA, con OID nuevo; entonces la
--   guarda de idempotencia del paso 2 ve que is_teacher ya existe y SE LO SALTA
--   SIN DECIR NADA. Quedarias con is_admin() intacta -a la que siguen apuntando
--   las 15 policies, y con el cuerpo viejo-, una is_teacher() huerfana, y la
--   fila ya en 'teacher': todas las escrituras denegadas, y la migracion
--   commiteada sin un solo error.
--
--   Es el mismo modo de fallo que el drop column prematuro que documenta
--   20260918120000: el cuerpo de una funcion sql es una cadena, PostgreSQL no
--   registra dependencias sobre lo que nombra, y nada avisa.
--
-- Se aplica de una sola vez, pegando el archivo entero. Sin begin/commit
-- explicitos: el SQL Editor ya envuelve el script en una transaccion implicita.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Cinturon de seguridad
--
-- Los 15 alter policy toman AccessExclusiveLock sobre las 7 tablas y lo RETIENEN
-- HASTA EL COMMIT. Si una consulta larga ya tiene lock sobre alguna, esta
-- migracion se queda esperando mientras YA retiene los locks de las anteriores,
-- y la aplicacion se congela entera. Mejor que falle y se reintente.
-- ----------------------------------------------------------------------------

set local lock_timeout = '5s';


-- ----------------------------------------------------------------------------
-- 1. Los 15 nombres de policy
--
-- alter policy ... rename to existe desde 9.5, pero NO admite if exists: la
-- gramatica solo tiene "alter policy nombre on tabla rename to nombre". De ahi
-- el bloque do consultando pg_policies.
--
-- El rename solo escribe pg_policy.polname. polqual, polwithcheck, polroles y
-- polcmd no se tocan, asi que NO HAY QUE RETECLEAR 15 EXPRESIONES using/with
-- check. Cada una de esas 15 seria una oportunidad de que una errata se
-- convirtiera en un agujero de autorizacion.
--
-- Doble condicion -el viejo existe Y el nuevo no- para que reejecutar no toque
-- nada.
-- ----------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select * from (values
      ('modules',           'modules_insert_admin',         'modules_insert_teacher'),
      ('modules',           'modules_update_admin',         'modules_update_teacher'),
      ('modules',           'modules_delete_admin',         'modules_delete_teacher'),
      ('lessons',           'lessons_insert_admin',         'lessons_insert_teacher'),
      ('lessons',           'lessons_update_admin',         'lessons_update_teacher'),
      ('lessons',           'lessons_delete_admin',         'lessons_delete_teacher'),
      ('blocks',            'blocks_insert_admin',          'blocks_insert_teacher'),
      ('blocks',            'blocks_update_admin',          'blocks_update_teacher'),
      ('blocks',            'blocks_delete_admin',          'blocks_delete_teacher'),
      ('exercises',         'exercises_insert_admin',       'exercises_insert_teacher'),
      ('exercises',         'exercises_update_admin',       'exercises_update_teacher'),
      ('exercises',         'exercises_delete_admin',       'exercises_delete_teacher'),
      ('exercise_attempts', 'attempts_select_admin',        'attempts_select_teacher'),
      ('lesson_progress',   'progress_select_admin',        'progress_select_teacher'),
      ('ai_interactions',   'ai_interactions_select_admin', 'ai_interactions_select_teacher')
    ) as t(tabla, viejo, nuevo)
  loop
    if exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = p.tabla and policyname = p.viejo
       )
       and not exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = p.tabla and policyname = p.nuevo
       )
    then
      execute format('alter policy %I on public.%I rename to %I', p.viejo, p.tabla, p.nuevo);
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 2. El nombre de la funcion
--
-- VA ANTES DEL PASO 3. Ver la cabecera.
--
-- Mismo OID, misma fila de pg_proc: las 15 policies no se enteran y la ACL
-- -el revoke a anon y el grant a authenticated- sigue vigente sin reescribirla.
--
-- to_regprocedure y no el cast ::regprocedure: el primero devuelve null si no
-- encuentra, el segundo lanza excepcion.
-- ----------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.is_admin()') is not null
     and to_regprocedure('public.is_teacher()') is null
  then
    alter function public.is_admin() rename to is_teacher;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3. El cuerpo de la funcion
--
-- El rename NO toca prosrc: sin esto, is_teacher() seguiria preguntando por
-- has_role('admin'), y como el cuerpo es una cadena no hay dependencia
-- registrada que lo delate.
--
-- create or replace con firma identica REUTILIZA LA FILA DE pg_proc: mismo OID,
-- misma ACL, mismo dueno. Las 15 policies siguen resolviendo a ella.
--
-- Los tres atributos se repiten a proposito. Lo que create or replace no vuelve
-- a declarar, lo resetea al valor por defecto:
--
--   sin security definer -> security invoker
--   sin stable           -> volatile, y el planificador deja de cachear el
--                           resultado: un update que toque N filas llamaria N
--                           veces en vez de una
--   sin set search_path  -> proconfig a null, en una funcion security definer
--                           propiedad de postgres
-- ----------------------------------------------------------------------------

create or replace function public.is_teacher()
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select public.has_role('teacher');
$function$;

comment on function public.is_teacher() is
  'Criterio unico de "puede gestionar el contenido del curso". La invocan las 15 policies de escritura y las Edge Functions por RPC.';

-- No-ops si se llego aqui por el rename, porque la ACL viajo con el OID. Se
-- dejan para el camino de instalacion limpia.
revoke all on function public.is_teacher() from anon;
grant execute on function public.is_teacher() to authenticated;


-- ----------------------------------------------------------------------------
-- 4. La fila del catalogo
--
-- Un solo update cambia el rol de todo el mundo a la vez, porque has_role()
-- resuelve por nombre y user_roles apunta a roles(id), que no se toca.
--
-- La guarda del not exists no sobra: sin ella, una reejecucion contra una base
-- donde alguien ya hubiera creado un rol 'teacher' aparte violaria
-- roles_name_key.
-- ----------------------------------------------------------------------------

update public.roles
   set name = 'teacher'
 where name = 'admin'
   and not exists (select 1 from public.roles where name = 'teacher');


-- ----------------------------------------------------------------------------
-- 5. Recarga del cache de esquema
--
-- PostgREST enruta /rpc/<nombre> contra un cache en memoria de las funciones del
-- esquema expuesto, no contra el catalogo. Sin esto, las Edge Functions
-- redesplegadas con rpc('is_teacher') responderian PGRST202 igual que si no se
-- hubiera migrado: el problema solo se habria movido de lado.
--
-- El notify se entrega EN EL COMMIT, no al ejecutarse, asi que PostgREST recarga
-- viendo ya el estado final.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';


-- ============================================================================
-- Comprobacion
--
-- 1) Las 15 policies con el nombre nuevo, y ninguna qual puede mencionar
--    is_admin:
--
--      select tablename, policyname, qual from pg_policies
--      where schemaname = 'public' and policyname like '%\_teacher'
--      order by 1, 2;
--
-- 2) No queda ningun nombre viejo (debe dar 0):
--
--      select count(*) from pg_policies
--      where schemaname = 'public' and policyname like '%\_admin';
--
-- 3) La funcion conservo sus atributos. prosecdef = t, provolatile = 's',
--    proconfig = {search_path=public}:
--
--      select oid, proname, prosecdef, provolatile, proconfig
--      from pg_proc where proname in ('is_teacher', 'is_admin');
--
--    is_admin no debe aparecer.
--
-- 4) Ninguna funcion menciona ya el nombre viejo en su cuerpo (debe dar 0):
--
--      select p.proname from pg_proc p
--      join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname = 'public' and p.prosrc ilike '%is_admin%';
--
-- 5) Quien era admin conserva el rol, ahora con el nombre nuevo:
--
--      select p.email, array_agg(r.name order by r.name)
--      from profiles p join user_roles ur using (user_id)
--      join roles r on r.id = ur.role_id
--      group by 1 order by 1;
--
-- select public.is_teacher() desde el editor da false porque auth.uid() es
-- nulo; para probarlo de verdad hay que impersonar dentro de una transaccion
-- que se revierta, como en las migraciones anteriores.
--
--
-- INMEDIATAMENTE DESPUES, redesplegar las dos Edge Functions:
--
--   npx supabase functions deploy generate-content generate-exercise
--
-- Entre el commit de esta migracion y ese despliegue hay una ventana en la que
-- generate-content y generate-exercise llaman a un nombre que ya no existe y
-- responden 403 "No se pudo verificar el rol del usuario". Es esperado: no
-- afecta ni al login, ni al panel, ni al CRUD, solo a la generacion con IA. Si
-- aparece ese 403, falta el despliegue.
-- ============================================================================
