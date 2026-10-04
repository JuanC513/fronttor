-- ============================================================================
-- Politicas de acceso al contenido del curso y a los perfiles.
--
-- Define quien puede leer y escribir modules, lessons, blocks, profiles y roles.
--
-- DEPENDE de 20260818120000_exercises_attempts_progress.sql, que crea la funcion
-- is_admin(). Aplicar en ese orden.
--
-- El modelo es:
--
--   * El contenido del curso (modules, lessons, blocks) lo lee cualquier usuario
--     autenticado y solo lo escribe un admin.
--   * Cada usuario ve unicamente su propio perfil, y de el solo puede editar la
--     descripcion: ni su rol ni su identidad.
--   * El catalogo de roles es de solo lectura desde la aplicacion.
--
-- Los `drop policy if exists` hacen el archivo reaplicable y limpian nombres de
-- policy que pudieran venir de plantillas por defecto.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Contenido del curso
--
-- La lectura es abierta a cualquier autenticado: el curso esta para consultarse.
-- La escritura pasa por is_admin(), de modo que el control viva en la base de
-- datos y no dependa de la navegacion del cliente, que un usuario controla.
-- ----------------------------------------------------------------------------

-- modules
drop policy if exists "Enable read for authenticated users only"   on public.modules;
drop policy if exists "Enable insert for authenticated users only" on public.modules;
drop policy if exists "Enable update for authenticated users only" on public.modules;
drop policy if exists modules_select_authenticated on public.modules;
drop policy if exists modules_insert_admin on public.modules;
drop policy if exists modules_update_admin on public.modules;
drop policy if exists modules_delete_admin on public.modules;

create policy modules_select_authenticated on public.modules
  for select to authenticated using (true);

create policy modules_insert_admin on public.modules
  for insert to authenticated with check (public.is_admin());

create policy modules_update_admin on public.modules
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy modules_delete_admin on public.modules
  for delete to authenticated using (public.is_admin());

-- lessons
drop policy if exists "Enable read for authenticated users only"   on public.lessons;
drop policy if exists "Enable insert for authenticated users only" on public.lessons;
drop policy if exists "Enable update for authenticated users only" on public.lessons;
drop policy if exists lessons_select_authenticated on public.lessons;
drop policy if exists lessons_insert_admin on public.lessons;
drop policy if exists lessons_update_admin on public.lessons;
drop policy if exists lessons_delete_admin on public.lessons;

create policy lessons_select_authenticated on public.lessons
  for select to authenticated using (true);

create policy lessons_insert_admin on public.lessons
  for insert to authenticated with check (public.is_admin());

create policy lessons_update_admin on public.lessons
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lessons_delete_admin on public.lessons
  for delete to authenticated using (public.is_admin());

-- blocks
drop policy if exists "Enable read for authenticated users only"   on public.blocks;
drop policy if exists "Enable insert for authenticated users only" on public.blocks;
drop policy if exists "Enable update for authenticated users only" on public.blocks;
drop policy if exists blocks_select_authenticated on public.blocks;
drop policy if exists blocks_insert_admin on public.blocks;
drop policy if exists blocks_update_admin on public.blocks;
drop policy if exists blocks_delete_admin on public.blocks;

create policy blocks_select_authenticated on public.blocks
  for select to authenticated using (true);

create policy blocks_insert_admin on public.blocks
  for insert to authenticated with check (public.is_admin());

create policy blocks_update_admin on public.blocks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy blocks_delete_admin on public.blocks
  for delete to authenticated using (public.is_admin());


-- ----------------------------------------------------------------------------
-- 2. Perfiles
--
-- Cada usuario ve y edita unicamente su propia fila, pero no todas sus columnas:
-- el rol no puede cambiarlo el propio usuario, porque es lo que determina si
-- puede administrar el contenido.
--
-- Esa distincion no se puede expresar con RLS, que opera por FILA y no por
-- columna: la policy comprueba a que fila se accede, no que campos se tocan. El
-- limite por columna se define con permisos, y como un permiso concedido sobre
-- la tabla completa no se puede recortar despues, se concede unicamente sobre la
-- columna editable.
--
-- La fila del perfil la crea el trigger handle_new_user al registrarse, que al
-- ser SECURITY DEFINER no depende de estos permisos.
-- ----------------------------------------------------------------------------

drop policy if exists "Enable users to view their own data only"  on public.profiles;
drop policy if exists "Enable update for users based on user_id"  on public.profiles;
drop policy if exists "Enable insert for users based on user_id"  on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on table public.profiles from authenticated;

-- Unica columna que el usuario puede editar de su propio perfil.
grant update (profile_description) on table public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Catalogo de roles
--
-- Solo lectura desde la aplicacion: los roles se administran desde el panel de
-- Supabase, no desde el cliente.
-- ----------------------------------------------------------------------------

drop policy if exists "Enable insert for authenticated users only" on public.roles;
drop policy if exists roles_select_authenticated on public.roles;

create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

revoke insert, update, delete on table public.roles from authenticated;


-- ----------------------------------------------------------------------------
-- 4. Acceso anonimo
--
-- Ninguna policy de este archivo aplica al rol anonimo, asi que ya queda sin
-- acceso. Se revoca ademas de forma explicita para que los datos personales no
-- dependan unicamente de la ausencia de una policy.
-- ----------------------------------------------------------------------------

revoke all on table public.profiles from anon;
revoke all on table public.roles    from anon;


-- ============================================================================
-- Comprobacion
--
-- Con un JWT de estudiante, las cuatro deben fallar o afectar 0 filas:
--
--   insert into modules (name, "order") values ('prueba', 99);
--   update  blocks   set content = 'prueba' where id = 1;
--   delete  from lessons where id = 1;
--   update  profiles set role_id = 2 where user_id = auth.uid();
--
-- Con un JWT de admin, las tres primeras deben funcionar; la cuarta debe fallar
-- igualmente, porque el rol no se cambia desde la aplicacion.
--
-- Y el panel de administracion debe seguir operando completo: crear, editar,
-- reordenar y borrar temas, subtemas y bloques.
-- ============================================================================
