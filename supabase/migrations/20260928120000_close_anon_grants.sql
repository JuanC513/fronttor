-- ============================================================================
-- Lo que `anon` puede ejecutar, cerrado de una vez y para lo que venga.
--
-- `anon` es el rol de la clave publicable que viaja en el bundle de Angular:
-- cualquiera que abra la aplicacion la tiene. Las TABLAS ya se le cerraron en
-- 20260919120000 y 20260919120100. Las FUNCIONES y las SECUENCIAS no, y siguen
-- abiertas.
--
-- EL INVENTARIO, medido sobre schema-actual.sql
--   18 funciones con GRANT ALL ... TO anon explicito: las 16 RPC de contenido
--      -insert/update/delete/reorder x modulo, subtema, bloque, ejercicio- mas
--      handle_new_user() y rls_auto_enable().
--   Todas las del volcado conservan ademas el EXECUTE de PUBLIC. En el volcado
--      no hay una sola linea REVOKE, asi que has_role, is_teacher y
--      mark_lesson_viewed -a las que si se les revoco anon en su dia- siguen
--      siendo ejecutables por anon A TRAVES DE PUBLIC.
--    8 secuencias con GRANT ALL ... TO anon, con lo que anon puede llamar a
--      nextval() y quemar ids.
--
-- NO ES EXPLOTABLE HOY, y conviene decirlo con precision
--   - Las 16 RPC de contenido son security invoker: corren con los privilegios
--     de quien llama, y anon ya no tiene ningun GRANT sobre modules, lessons,
--     blocks ni exercises. La llamada muere con "permission denied for table".
--   - handle_new_user() devuelve trigger y rls_auto_enable() devuelve
--     event_trigger: PostgreSQL no permite invocarlas directamente y PostgREST
--     no las expone.
--   - has_role, is_teacher y mark_lesson_viewed resuelven el usuario con
--     auth.uid(), que para anon es null: las dos primeras devuelven false y la
--     tercera lanza 42501.
--
-- ENTONCES POR QUE HACERLO
--   1. Deja de ser una nota al pie y pasa a ser verificable. Hoy "que puede
--      hacer un anonimo" se responde leyendo el cuerpo de 25 funciones; despues
--      se responde con una consulta que devuelve cero filas -la de la seccion
--      "Comprobacion" del README-.
--   2. Para dejar de depender de acordarse. La causa raiz es la seccion 3 de
--      aqui abajo: el proyecto concede por defecto a anon todo objeto nuevo. Por
--      eso este mismo descuido ya hubo que corregirlo a mano en 20260818120000,
--      20260922120000, 20260926120000, 20260927120000 y 20260927130000.
--   3. Es la capa que queda cuando falla la otra. El argumento del apartado
--      anterior es "la RLS y los grants de tabla lo detienen", y ese es
--      exactamente el razonamiento que 20260818120000 ya rechazo por fragil
--      cuando se trataba de las tablas.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las funciones
--
-- POR QUE `from public` Y NO SOLO `from anon`
-- Lo documenta la seccion 3 de 20260922120000: PostgreSQL concede EXECUTE a
-- PUBLIC al crear cada funcion, y anon forma parte de PUBLIC, de modo que
-- revocarle solo la concesion DIRECTA no le quita nada.
--
-- POR QUE UNA SENTENCIA DE CONJUNTO Y NO UNA LISTA DE FIRMAS
-- Porque una lista escrita a mano seria incompleta por construccion. SIETE
-- funciones que existen en la base no las crea ninguna migracion de este repo
-- -delete_module, delete_lesson, delete_block, reorder_modules, reorder_lessons,
-- reorder_blocks y rls_auto_enable-; se crearon en el dashboard y solo viven en
-- schema-actual.sql, y las seis primeras las llama la aplicacion. Y de las que
-- si estan, las firmas no coinciden: insert_exercise tiene 13 parametros en la
-- base y el grant de 20260818120000 nombra 9.
--
-- QUE NO TOCA
-- Ni authenticated ni service_role: sus concesiones son explicitas y
-- `revoke ... from public, anon` no las alcanza. Se comprobo funcion por funcion
-- en el volcado: todas las que usa la aplicacion tienen su GRANT a authenticated
-- propio, asi que ninguna depende de PUBLIC para funcionar. La unica sin
-- concesion a authenticated es recompute_lesson_progress, que es interna y debe
-- seguir asi.
--
-- Y los triggers siguen funcionando: PostgreSQL comprueba el EXECUTE de la
-- funcion de un trigger AL CREARLO, no al dispararlo.
-- ----------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon;


-- ----------------------------------------------------------------------------
-- 2. Las secuencias
--
-- Sin GRANT de INSERT sobre ninguna tabla, esto no permite escribir nada; lo que
-- permitia era gastar ids ajenos con nextval(). Las secuencias no tienen
-- concesion por defecto a PUBLIC, asi que aqui basta con anon.
-- ----------------------------------------------------------------------------

revoke all on all sequences in schema public from anon;


-- ----------------------------------------------------------------------------
-- 3. La causa raiz: el privilegio por defecto
--
-- El proyecto trae -es la configuracion estandar de Supabase- estas entradas:
--
--   alter default privileges for role postgres in schema public
--     grant all on functions to anon;   -- y lo mismo en sequences y tables
--
-- Eso es lo que hace que cada objeto NUEVO nazca abierto a anon, y es la razon
-- por la que las cinco migraciones citadas arriba tuvieron que revocar a mano.
-- Mientras siga ahi, el barrido de las secciones 1 y 2 caduca con la siguiente
-- funcion que se cree.
--
-- Solo afecta a objetos FUTUROS, y solo a los creados por el rol postgres. Ese es
-- el que importa: el editor SQL del dashboard corre con current_user = postgres
-- -comprobado-, asi que es el rol con el que este proyecto crea TODO lo que hay
-- en public.
--
-- QUEDA UNA ENTRADA FUERA DE ALCANCE, Y ES DELIBERADO
-- pg_default_acl tiene ademas una entrada de supabase_admin que si concede a
-- anon. No se toca: es un rol de la plataforma, no del proyecto; `alter default
-- privileges for role supabase_admin` desde postgres se niega por permisos, y si
-- no se negara seria peor, porque estaria cambiando configuracion de Supabase.
-- Como nada de este proyecto crea objetos con ese rol, no tiene efecto practico;
-- la consulta de comprobacion del README lo vigila por si algun dia lo tuviera.
--
-- LA REGLA NUEVA, Y SU COSTE
-- La entrada de authenticated se queda intacta, de modo que una tabla nueva
-- sigue naciendo con sus permisos. Lo que cambia es que una FUNCION nueva nace
-- cerrada y necesita su grant explicito:
--
--   grant execute on function public.lo_que_sea(...) to authenticated;
--
-- Si una migracion futura lo olvida, NO falla al aplicarse: falla al llamarse, con
-- 42501 "permission denied for function <nombre>". Se comprobo contra la base al
-- aplicar esta migracion: PostgREST no filtra su cache de esquema por rol, asi
-- que deja pasar la llamada y es Postgres quien la niega. El error dice
-- exactamente lo que pasa, que es la mejor version de este coste.
-- ----------------------------------------------------------------------------

alter default privileges for role postgres in schema public revoke all     on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all     on sequences from anon;
alter default privileges for role postgres in schema public revoke all     on tables    from anon;


-- ----------------------------------------------------------------------------
-- 4. Cache de esquema de PostgREST
--
-- PostgREST decide que funciones expone a partir de los permisos, no solo de que
-- existan. Sin esto seguiria anunciando en /rpc lo que ya no se puede llamar.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
