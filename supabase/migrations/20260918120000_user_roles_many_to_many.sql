-- ============================================================================
-- Roles multiples por usuario.
--
-- Hasta aqui el rol vivia en profiles.role_id: un entero, un rol. Eso obliga a
-- que quien administra el contenido sea O profesor O estudiante, y hace
-- imposible separar la vista de aprendizaje de la de administracion sin dejar
-- al profesor fuera del contenido que el mismo escribe.
--
-- A partir de aqui la pertenencia vive en la tabla puente user_roles, y la
-- columna profiles.role_id desaparece: una sola fuente de verdad.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea is_admin(),
-- y de 20260818130000_content_and_profile_policies.sql, de donde sale el patron
-- de politicas y permisos que aqui se replica.
--
-- NINGUNA POLITICA RLS CAMBIA. Las de modules, lessons, blocks, exercises,
-- exercise_attempts, lesson_progress y ai_interactions llaman todas a is_admin()
-- en vez de comprobar el rol por su cuenta, asi que redefinir el cuerpo de esa
-- funcion las actualiza a las siete a la vez.
--
--
-- EL ORDEN DE ESTE ARCHIVO NO ES LIBRE
--
--   is_admin() es language sql con el cuerpo en una cadena, de modo que
--   PostgreSQL no registra dependencia sobre profiles.role_id. Un drop column
--   antes de redefinirla COMMITEA SIN ERROR y deja la funcion rota en silencio:
--   el fallo aparece mas tarde, cuando cualquier escritura de admin muere con
--   "column p.role_id does not exist" y se lleva por delante el panel entero.
--
--   En sentido contrario, check_function_bodies rechaza redefinir is_admin()
--   mientras user_roles todavia no exista.
--
--   Entre las dos restricciones queda un unico orden valido, que es el de este
--   archivo: tabla, backfill, funciones, drop column.
--
-- Se aplica de una sola vez. El SQL Editor envuelve el script en una
-- transaccion implicita, asi que o entra todo o no entra nada; trocearlo pierde
-- esa garantia.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La tabla puente
--
-- user_id referencia a profiles y no a auth.users a proposito: sin ese enlace,
-- PostgREST no puede embeber profiles -> user_roles y el frontend no tiene forma
-- de pedir perfil y roles en una sola consulta. La cascada de borrado sigue
-- llegando igual, encadenada: auth.users -> profiles -> user_roles.
--
-- La clave primaria compuesta impide conceder dos veces el mismo rol y ya sirve
-- de indice para la busqueda por usuario, que es la que hace has_role().
-- ----------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role_id integer not null references public.roles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);


-- ----------------------------------------------------------------------------
-- 2. Cerrar la tabla
--
-- Va antes de meterle una sola fila, porque NACE ABIERTA: los privilegios por
-- defecto del esquema public de Supabase conceden GRANT ALL a anon y a
-- authenticated sobre cada tabla nueva. Sin las lineas de abajo, cualquier
-- usuario autenticado se nombra administrador con
--
--   insert into user_roles values (auth.uid(), 2);
--
-- Hasta ahora eso no era posible porque el rol era una columna de profiles
-- protegida por permisos de columna. Al mudarlo a otra tabla, esa proteccion
-- deja de aplicar y hay que rehacerla aqui.
--
-- Son dos capas, y se combinan con AND, no con OR: los permisos cortan la
-- escritura aunque alguien anada manana una politica descuidada, y la RLS corta
-- la lectura ajena aunque alguien reconceda GRANT ALL.
--
-- Se revoca TODO y se vuelve a conceder select, en vez de quitar solo insert,
-- update y delete. El motivo es TRUNCATE: no es una de esas tres, NO PASA POR LA
-- RLS, y vaciaria la tabla de una vez dejando a todo el mundo sin roles. Hoy no
-- se puede alcanzar porque PostgREST no expone esa operacion, pero eso es una
-- propiedad de la capa de encima y no algo que este archivo pueda garantizar.
-- Enumerar lo que se quita obliga a acertar con la lista entera; conceder solo
-- lo que hace falta no.
--
-- No se referencia is_admin() en ninguna politica de esta tabla. Los roles se
-- asignan desde el SQL Editor, que corre como postgres y se salta la RLS, asi
-- que un administrador no necesita ningun permiso sobre la tabla puente a traves
-- de la API. Darselo solo anadiria superficie.
--
-- Y no se pone force row level security: someteria al dueno de la tabla a sus
-- propias politicas, y como is_admin() lee user_roles, eso si crearia la
-- recursion infinita que hoy no existe.
-- ----------------------------------------------------------------------------

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;

create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- Sin politica de insert, update ni delete. Ninguna, a proposito.

revoke all on table public.user_roles from anon;
revoke all on table public.user_roles from authenticated;
grant select on table public.user_roles to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Traslado de lo que ya existe
--
-- Guardado por "si todavia existe profiles.role_id", igual que la carga inicial
-- de is_published en 20260830120000: asi reejecutar el archivo no deshace lo que
-- se haya ajustado a mano despues.
--
-- El segundo insert va DENTRO de la misma guarda por ese motivo. Si quedara
-- fuera, una reejecucion le devolveria el rol student a quien se lo hubieran
-- retirado.
--
-- Se usa execute con SQL dinamico porque plpgsql prepara las sentencias que
-- contiene, y estas nombran una columna que este mismo archivo elimina mas
-- abajo.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role_id'
  ) then
    -- a) Conservar el rol que cada usuario tiene hoy.
    execute '
      insert into public.user_roles (user_id, role_id)
      select user_id, role_id from public.profiles
      on conflict do nothing
    ';

    -- b) student como linea base para todos, incluidos los administradores.
    --
    -- La vista de aprendizaje pasa a exigir ese rol, y sin esto el unico
    -- administrador que hay se quedaria fuera del contenido que administra.
    execute '
      insert into public.user_roles (user_id, role_id)
      select p.user_id, r.id
      from public.profiles p
      cross join public.roles r
      where r.name = ''student''
      on conflict do nothing
    ';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 4. El criterio de rol
--
-- has_role generaliza el join que hasta ahora estaba metido dentro de is_admin,
-- e is_admin pasa a ser un caso particular suyo. Conserva firma y semantica, que
-- es lo que permite que las politicas existentes sigan valiendo sin tocarlas.
--
-- security definer es imprescindible: la politica de user_roles solo deja ver
-- las filas propias, y ademas es lo que evita la recursion, porque las politicas
-- no se aplican al dueno de la tabla.
--
-- has_role NO RECIBE NUNCA UN user_id. Informa solo sobre auth.uid(), y por eso
-- es inofensivo tenerlo expuesto como RPC. Un has_role(uuid, text) seria un
-- oraculo de los roles ajenos al alcance de cualquier autenticado.
-- ----------------------------------------------------------------------------

create or replace function public.has_role(p_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = p_role
  );
$function$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $function$
  select public.has_role('admin');
$function$;

revoke all on function public.has_role(text) from anon;
grant execute on function public.has_role(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Alta de usuarios
--
-- El rol se busca por nombre en vez del literal 1 que estaba escrito a mano. Es
-- el mismo criterio que usan has_role() y el frontend, y el propio seed.sql
-- admitia que la correspondencia entre id y nombre estaba inferida.
--
-- El perfil va primero: user_roles tiene clave foranea hacia el.
--
-- Si la tabla roles estuviera vacia, el insert no fallaria y el usuario quedaria
-- sin ningun rol, sin poder entrar a ninguna vista y sin ningun aviso. Mejor que
-- el registro falle de forma ruidosa.
--
-- set search_path le faltaba, siendo security definer. Se anade aprovechando.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email);

  insert into public.user_roles (user_id, role_id)
  select new.id, id from public.roles where name = 'student';

  if not found then
    raise exception 'No existe el rol student en public.roles; revisa seed.sql';
  end if;

  return new;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 6. Fuera la columna
--
-- Ya no la lee nadie: ni is_admin(), ni handle_new_user(), ni el frontend.
-- Mantenerla obligaria a sincronizar dos fuentes que pueden discrepar.
--
-- No se pierde informacion: user_roles contiene estrictamente mas que ella.
-- ----------------------------------------------------------------------------

alter table public.profiles drop column if exists role_id;


-- ----------------------------------------------------------------------------
-- 7. Recarga del cache de esquema
--
-- PostgREST cachea las relaciones entre tablas. Sin esto, la consulta que el
-- frontend hace con el embed anidado puede responder PGRST200 hasta que el
-- cache se refresque por su cuenta.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';


-- ============================================================================
-- Comprobacion
--
-- Nadie se queda sin roles (debe dar 0):
--
--   select count(*) from profiles p
--   where not exists (select 1 from user_roles ur where ur.user_id = p.user_id);
--
-- Quien era admin lo sigue siendo, y ademas es student:
--
--   select p.email, array_agg(r.name order by r.name)
--   from profiles p
--   join user_roles ur using (user_id)
--   join roles r on r.id = ur.role_id
--   group by 1 order by 1;
--
-- La tabla quedo cerrada: una sola politica, de SELECT, y authenticated sin mas
-- permiso que select.
--
--   select policyname, cmd from pg_policies where tablename = 'user_roles';
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'user_roles' order by 1, 2;
--
-- Y que un estudiante no puede auto-concederse un rol. Impersonando dentro de
-- una transaccion que se revierte, las cuatro deben fallar:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--   insert into user_roles values ('<uuid>', 2);
--   update user_roles set role_id = 2 where user_id = '<uuid>';
--   delete from user_roles where user_id = '<uuid>';
--   update roles set name = 'admin' where name = 'student';
--   rollback;
--
-- El texto del error importa: debe decir "permission denied for table
-- user_roles", que es el revoke. Si dice "violates row-level security policy",
-- lo corto solo la RLS y se esta con una capa en vez de dos.
-- ============================================================================
