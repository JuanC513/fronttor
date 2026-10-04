-- ============================================================================
-- El trigger que crea el perfil al registrarse.
--
-- DEPENDE de 20260918120000_user_roles_many_to_many.sql, que define la version
-- vigente de handle_new_user().
--
--
-- POR QUE EXISTE ESTE ARCHIVO
--
-- schema-actual.sql se genera con --schema public, y este trigger cuelga de
-- auth.users. Resultado: el repositorio traia la funcion handle_new_user() pero
-- no el trigger que la dispara. En un proyecto nuevo eso se levanta sin error
-- aparente y el fallo llega despues, cuando el primer registro no crea perfil y
-- por tanto el usuario no existe para la aplicacion.
--
-- En el proyecto actual este archivo NO HACE NADA: el trigger ya esta creado, y
-- la migracion anterior cambia su comportamiento con create or replace function
-- sin necesidad de tocarlo. Su valor es que un proyecto nuevo quede completo.
--
--
-- POR QUE VA SEPARADO Y POR QUE NO LLEVA DROP TRIGGER
--
-- auth.users pertenece a supabase_auth_admin, no a postgres. Un drop trigger
-- sobre ella puede fallar con "must be owner of relation users", y al ir todo en
-- una transaccion implicita eso tumbaria la migracion entera. Por eso se crea
-- solo si falta, y por eso va aparte de la migracion que si tiene que entrar si
-- o si.
--
-- La comprobacion busca POR FUNCION, no por nombre. El nombre del trigger que
-- hay en el proyecto actual no consta en ningun sitio del repositorio, y
-- adivinarlo mal significaria acabar con dos triggers, dos perfiles por registro
-- y una violacion de clave primaria que impide registrarse a cualquiera.
-- Preguntando por la funcion, el guardado funciona se llame como se llame.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and p.proname = 'handle_new_user'
      and p.pronamespace = 'public'::regnamespace
  ) then
    execute '
      create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user()
    ';
  end if;
end $$;


-- ============================================================================
-- Comprobacion
--
-- Debe devolver exactamente una fila, y su definicion debe nombrar
-- public.handle_new_user():
--
--   select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--   where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- La prueba de verdad es registrar un usuario desde la aplicacion: debe aparecer
-- una fila en profiles y exactamente una en user_roles, con el rol student.
-- ============================================================================
