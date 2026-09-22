-- ============================================================================
-- Recorte de permisos sobre las tablas de identidad.
--
-- DEPENDE de 20260818130000_content_and_profile_policies.sql, que fija las
-- policies de profiles y roles, y de 20260918120000_user_roles_many_to_many.sql,
-- que es donde vive user_roles.
--
--
-- QUE PROBLEMA RESUELVE
--
-- Los privilegios por defecto del esquema public de Supabase conceden GRANT ALL
-- a anon y a authenticated sobre cada tabla nueva. Las migraciones anteriores
-- recortaron eso enumerando lo que sobraba:
--
--   revoke insert, update, delete on table public.profiles from authenticated;
--
-- Esa forma tiene un fallo: obliga a acertar con la lista COMPLETA de permisos
-- que sobran, y esa lista crece con cada version de PostgreSQL. Lo que quedo
-- concedido, y se ve en el volcado del esquema, fue:
--
--   SELECT, REFERENCES, TRIGGER, TRUNCATE, MAINTAIN
--
-- De esos, el que importa es TRUNCATE: no es insert, ni update, ni delete, asi
-- que ningun revoke lo alcanzo, y sobre todo NO PASA POR LA ROW LEVEL SECURITY.
-- Un truncate sobre profiles o user_roles vaciaria la tabla entera de una vez,
-- sin que ninguna policy pudiera opinar.
--
-- Hoy no es alcanzable, porque PostgREST no expone TRUNCATE y la aplicacion solo
-- habla con la base por ahi. Pero eso es una propiedad de la capa de encima, no
-- algo que la base garantice: el dia que algo mas se conecte con la misma clave
-- y hable SQL de verdad, la unica defensa habria desaparecido.
--
-- La correccion es invertir el sentido: revocar TODO y conceder despues
-- unicamente lo que la aplicacion necesita. Enumerar lo que se quita obliga a
-- acertar; enumerar lo que se da, no.
--
-- No cambia ninguna policy ni ninguna funcion. Es solo la capa de permisos, que
-- se combina con la RLS mediante AND: la RLS ya decidia bien, aqui se corrige lo
-- que la RLS no puede ver.
--
-- Es seguro reejecutarlo cuantas veces haga falta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. profiles
--
-- Dos concesiones, y ninguna mas:
--
--   select                       lo necesita AuthService.loadProfile, acotado a
--                                la fila propia por profiles_select_own.
--   update (profile_description) la unica columna que el usuario puede editar de
--                                su propio perfil.
--
-- El update va por COLUMNA a proposito. La RLS opera por fila y no puede impedir
-- que alguien toque un campo concreto; el limite por campo solo se expresa con
-- permisos. Antes ese grant convivia con un revoke parcial; ahora se vuelve a
-- conceder despues del revoke total, porque revocar todo sobre la tabla tambien
-- se lleva las concesiones de columna.
--
-- La fila la sigue creando el trigger handle_new_user, que al ser security
-- definer no depende de nada de esto.
-- ----------------------------------------------------------------------------

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (profile_description) on table public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- 2. roles
--
-- Catalogo de solo lectura. Se consulta al resolver el nombre del rol, tanto
-- desde el frontend como dentro de has_role().
--
-- Que la escritura este cerrada importa mas de lo que parece: todo el sistema
-- decide si alguien es administrador comparando roles.name contra 'admin', asi
-- que poder renombrar una fila de esta tabla equivale a poder repartir el rol.
-- ----------------------------------------------------------------------------

revoke all on table public.roles from anon;
revoke all on table public.roles from authenticated;

grant select on table public.roles to authenticated;


-- ----------------------------------------------------------------------------
-- 3. user_roles
--
-- Se repite aqui por si la migracion anterior se aplico antes del ajuste, en
-- cuya version el revoke todavia era parcial. Si ya se aplico con el revoke
-- total, estas tres lineas no cambian nada.
-- ----------------------------------------------------------------------------

revoke all on table public.user_roles from anon;
revoke all on table public.user_roles from authenticated;

grant select on table public.user_roles to authenticated;


-- ============================================================================
-- Lo que este archivo NO toca
--
-- Las tablas de contenido y de practica conservan los privilegios por defecto:
--
--   modules, lessons, blocks, exercises        GRANT ALL a anon Y a authenticated
--   exercise_attempts, lesson_progress,
--   ai_interactions                            GRANT ALL a authenticated
--
-- Su RLS si esta bien puesta y es la que impide leer y escribir lo que no toca,
-- de modo que por la API se comportan correctamente. Pero arrastran el mismo
-- hueco de TRUNCATE, y en las cuatro primeras alcanza incluso a anon, que es la
-- clave publicable que viaja en el bundle de la aplicacion.
--
-- Se dejan fuera a proposito: son las tablas sobre las que la aplicacion escribe
-- constantemente, y recortarlas pide comprobar una por una que no se quita nada
-- que haga falta. Es una migracion aparte, no un anadido a esta.
--
--
-- Comprobacion
--
-- Cada una debe devolver exactamente lo que dice el comentario:
--
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name in ('profiles', 'roles', 'user_roles')
--     and grantee in ('anon', 'authenticated')
--   order by table_name, grantee, privilege_type;
--
--   profiles     authenticated  SELECT
--   profiles     authenticated  UPDATE   <- solo sobre profile_description
--   roles        authenticated  SELECT
--   user_roles   authenticated  SELECT
--
-- Y anon no debe aparecer en ninguna fila.
--
-- El limite por columna del update se comprueba aparte, porque la consulta de
-- arriba no lo distingue:
--
--   select column_name from information_schema.column_privileges
--   where table_name = 'profiles' and grantee = 'authenticated'
--     and privilege_type = 'UPDATE';
--
--   profile_description
--
-- Despues, con la aplicacion: iniciar sesion debe seguir cargando el perfil con
-- sus roles (si algo de esto sobra, el sidebar pierde sus enlaces), y editar la
-- descripcion del perfil debe seguir funcionando.
-- ============================================================================
