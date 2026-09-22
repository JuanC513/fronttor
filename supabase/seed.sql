-- ============================================================================
-- Datos semilla.
--
-- El volcado de esquema (schema-actual.sql) trae solo estructura, sin filas.
-- Estos son los unicos datos sin los cuales la aplicacion no arranca en un
-- proyecto nuevo: `handle_new_user` busca el rol llamado 'student' para
-- concederselo a quien se registra, y lanza una excepcion si no lo encuentra.
-- Con esta tabla vacia, nadie puede registrarse.
--
-- config.toml ya apunta aqui: [db.seed] sql_paths = ["./seed.sql"]
--
-- Los ids de aqui son una conveniencia, no un contrato: desde
-- 20260918120000_user_roles_many_to_many.sql, nada en el sistema depende de que
-- student sea el 1 ni teacher el 2. Tanto has_role() como el trigger y el frontend
-- resuelven el rol POR NOMBRE, que es la unica columna con restriccion de
-- unicidad.
-- ============================================================================

insert into public.roles (id, name)
values (1, 'student'),
       (2, 'teacher')
on conflict do nothing;

-- Realinea la secuencia con el maximo id insertado. Sin esto, el primer rol que
-- se cree despues chocaria con un id ya ocupado.
select setval(
  pg_get_serial_sequence('public.roles', 'id'),
  coalesce((select max(id) from public.roles), 1),
  true
);
