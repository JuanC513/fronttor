-- ============================================================================
-- Datos semilla.
--
-- El volcado de esquema (schema-actual.sql) trae solo estructura, sin filas.
-- Estos son los unicos datos sin los cuales la aplicacion no arranca en un
-- proyecto nuevo: `handle_new_user` inserta cada perfil con role_id = 1, asi que
-- si la tabla `roles` esta vacia, ningun usuario puede registrarse.
--
-- config.toml ya apunta aqui: [db.seed] sql_paths = ["./seed.sql"]
--
-- VERIFICAR ANTES DE USAR EN UN PROYECTO NUEVO: los ids salen de que
-- handle_new_user documenta `1 = student`; el 2 para admin esta inferido. En el
-- proyecto actual conviene confirmarlo con `select * from roles;` y ajustar.
-- ============================================================================

insert into public.roles (id, name)
values (1, 'student'),
       (2, 'admin')
on conflict (id) do nothing;

-- Realinea la secuencia con el maximo id insertado. Sin esto, el primer rol que
-- se cree despues chocaria con un id ya ocupado.
select setval(
  pg_get_serial_sequence('public.roles', 'id'),
  coalesce((select max(id) from public.roles), 1),
  true
);
