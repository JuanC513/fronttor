# Base de datos y funciones de Supabase

Esquema, políticas de acceso y datos semilla del proyecto.

## Archivos

| Archivo             | Qué es                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schema-actual.sql` | **Foto** del esquema remoto en un momento dado. Se genera con `supabase db dump`; es un artefacto derivado, no se edita a mano. |
| `migrations/`       | **Fuente de verdad de los cambios.** Cada archivo se aplica una vez, en orden de nombre.                                        |
| `seed.sql`          | Datos mínimos sin los cuales la aplicación no arranca.                                                                          |
| `functions/`        | Edge Functions (Deno). Se despliegan aparte con `npx supabase functions deploy`.                                                |

Cuando se aplica una migración, la foto queda desactualizada. Para refrescarla:

```bash
npx supabase db dump --linked --schema public -f supabase/schema-actual.sql
```

## Orden de aplicación

1. `schema-actual.sql` — solo en un proyecto nuevo
2. `migrations/20260818120000_exercises_attempts_progress.sql`
3. `migrations/20260818130000_content_and_profile_policies.sql`
4. `migrations/20260830120000_content_publication.sql`
5. `migrations/20260908120000_exercise_solution.sql`
6. `migrations/20260918120000_user_roles_many_to_many.sql`
7. `migrations/20260918120100_auth_user_trigger.sql`
8. `migrations/20260919120000_tighten_identity_grants.sql`
9. `migrations/20260919120100_tighten_content_grants.sql`
10. `seed.sql`

El orden **no es opcional**: la 3 usa la función `is_admin()`, que crea la 2; la 4 redefine funciones que crea la 2; la 5 redefine las que deja la 4; la 6 redefine `is_admin()` y `handle_new_user()`, y la 7 depende de esa última.

El `seed.sql` va al final por una razón que cambió con la 6: `handle_new_user()` ahora busca el rol `student` **por nombre** y lanza una excepción si no lo encuentra, así que con la tabla `roles` vacía nadie puede registrarse.

## Cómo aplicarlos

### Desde el dashboard (recomendado)

No requiere instalar nada ni configurar credenciales: el editor ya se conecta con permisos de superusuario.

1. Dashboard → **SQL Editor** → **New query**
2. Copiar el contenido completo del archivo, pegarlo y pulsar **Run**
3. Esperar a que termine y repetir con el siguiente, en el orden de arriba

### Desde la terminal (alternativa)

Requiere tener instalado `psql`, que viene con PostgreSQL y no con Node ni con el CLI de Supabase.

```bash
psql "<connection-string>" -f supabase/migrations/20260818120000_exercises_attempts_progress.sql
```

El **connection string** no es la URL de la API. Son dos cosas distintas:

|                       | Para qué sirve                                                             | Forma                                                                         |
| --------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **API URL**           | La usa el cliente de Supabase desde Angular. Habla HTTP y no entiende SQL. | `https://<ref>.supabase.co/rest/v1/`                                          |
| **Connection string** | Conexión directa a PostgreSQL. Es lo que necesita `psql`.                  | `postgresql://postgres.<ref>:<password>@...pooler.supabase.com:6543/postgres` |

El connection string se copia del dashboard en **Settings → Database → Connection string**, eligiendo el formato **URI**. Trae un marcador `[YOUR-PASSWORD]` que hay que reemplazar por la **contraseña de la base de datos**, definida al crear el proyecto — no es ninguna de las API keys. En esa misma página se puede resetear si no se recuerda.

> `npx supabase db push` también existe, pero reconcilia contra la tabla de historial de migraciones. Como aquí el SQL se aplica a mano, ese historial no refleja el estado real y `db push` puede intentar reaplicar cosas. Mientras el flujo sea manual, mejor el dashboard o `psql`.

## Qué pasa al ejecutarlos

### En un proyecto nuevo

Queda todo montado desde cero: las tablas de contenido (`modules`, `lessons`, `blocks`), las de práctica y progreso (`exercises`, `exercise_attempts`, `lesson_progress`, `ai_interactions`), las de identidad (`profiles`, `roles`), las funciones RPC, las políticas de acceso y las filas de `roles`.

Lo que **no** se transfiere y hay que rehacer:

- **Los usuarios.** Viven en el esquema `auth`, que gestiona Supabase y no está en el volcado. Hay que registrarse de nuevo.
- **El primer administrador.** Todo el que se registra nace con el rol `student` y nada más. El primer `admin` se concede a mano (ver más abajo).
- **El secreto de las Edge Functions.** Volver a configurar `GEMINI_API_KEY`.
- **Las Edge Functions.** `npx supabase functions deploy` apuntando al proyecto nuevo.

### En un proyecto que ya tiene datos

Esto es lo que importa antes de ejecutar nada:

| Tabla                                                     | Efecto                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `auth.users`                                              | **Intacta.** Ninguna migración la toca.                      |
| `profiles`                                                | **Pierde la columna `role_id`**, cuyo contenido se traslada a `user_roles`. Las filas se conservan. |
| `roles`                                                   | **Datos intactos.** `seed.sql` usa `on conflict do nothing`. |
| `user_roles`                                              | **Se crea** y se rellena con los roles que había, más `student` para todos. |
| `modules`, `lessons`, `blocks`                            | **Datos intactos.** Solo cambian sus políticas.              |
| `exercises`                                               | **Se borra y se recrea.** Sus filas se pierden.              |
| `exercise_attempts`, `lesson_progress`, `ai_interactions` | Se crean si no existen; si ya existen, se conservan.         |

Es decir: las cuentas de usuario y su asociación con los roles **no se pierden** —cambian de sitio, de `profiles.role_id` a `user_roles`—, ni tampoco el contenido del curso. La única tabla cuyos datos desaparecen es `exercises`.

### Reejecutar

- **`20260818130000_content_and_profile_policies.sql` es seguro de reejecutar** cuantas veces haga falta: solo declara políticas y permisos, y cada uno va precedido de su `drop ... if exists`.

- **`20260818120000_exercises_attempts_progress.sql` está pensado para aplicarse una vez.** Reejecutarlo sobre una base con ejercicios cargados no solo los borra: el `drop table exercises cascade` se lleva por delante las claves foráneas que `exercise_attempts` y `ai_interactions` tienen hacia esa tabla, y como esas dos se crean con `create table if not exists`, al ya existir no se vuelven a crear y sus claves foráneas no se restauran. El resultado son intentos apuntando a ejercicios que ya no existen, sin nada que lo impida.

  Si hace falta reaplicarla con datos cargados, ejecutar solo desde la sección 2 en adelante, saltándose la creación de `exercises`.

- **`20260830120000_content_publication.sql` es seguro de reejecutar.** Añade la columna
  `is_published` y redefine funciones, todo comprobando antes si hace falta. La publicación del
  contenido que ya existía solo ocurre en la ejecución que crea la columna, de modo que reejecutarlo
  **no** publica los borradores que haya en ese momento.

- **`20260908120000_exercise_solution.sql` es seguro de reejecutar.** Añade columnas con `if not
  exists` y redefine dos funciones.

- **`20260918120000_user_roles_many_to_many.sql` es seguro de reejecutar.** Crea la tabla, las
  políticas y las funciones comprobando antes si hace falta. El traslado de los roles existentes
  solo ocurre en la ejecución que todavía encuentra la columna `profiles.role_id`, de modo que
  reejecutarlo **no** devuelve el rol `student` a quien se le haya retirado a mano.

- **`20260918120100_auth_user_trigger.sql` es seguro de reejecutar.** Solo crea el trigger si no
  hay ya uno que llame a `handle_new_user()`.

- **`20260919120000_tighten_identity_grants.sql` y
  `20260919120100_tighten_content_grants.sql` son seguros de reejecutar.** Solo revocan y conceden
  permisos, que es una operación idempotente por naturaleza.

- **`seed.sql` es seguro de reejecutar.**

## Comprobación

Después de aplicar, con un JWT de estudiante estas cuatro deben fallar o afectar 0 filas:

```sql
insert into modules (name, "order") values ('prueba', 99);
update  blocks   set content = 'prueba' where id = 1;
delete  from lessons where id = 1;
insert into user_roles (user_id, role_id) values (auth.uid(), 2);
```

La cuarta es la que impide que alguien se nombre administrador a sí mismo. Antes era
`update profiles set role_id = 2`, y lo que la bloqueaba eran los permisos de columna de `profiles`;
desde que el rol vive en `user_roles` lo bloquean el `revoke` de esa tabla y su RLS. **Conviene
leer el texto del error**: debe decir `permission denied for table user_roles`. Si dice
`violates row-level security policy`, el `revoke` no se aplicó y solo queda una de las dos capas.

Y con sesión de administrador, el panel debe seguir funcionando completo: crear, editar, reordenar y borrar temas, subtemas y bloques.

Además, ninguna RPC de contenido puede haber quedado duplicada por una sobrecarga. Esta consulta debe devolver exactamente ocho filas:

```sql
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('insert_module','update_module','insert_lesson','update_lesson',
                  'insert_block','update_block','insert_exercise','update_exercise')
order by proname;
```

Si sale alguna repetida, el panel fallará al guardar con *"Could not choose the best candidate function"*.

## Conceder roles

Un usuario puede tener varios roles a la vez, y la pertenencia vive en `user_roles`. **No se
administra desde la aplicación**: ni siquiera un administrador tiene permiso de escritura sobre esa
tabla a través de la API. Se hace desde el **SQL Editor**, que corre como `postgres` y no pasa por
la RLS.

```sql
-- Conceder. Es idempotente.
insert into public.user_roles (user_id, role_id)
select p.user_id, r.id
from public.profiles p, public.roles r
where p.email = 'alguien@ejemplo.com' and r.name = 'admin'
on conflict do nothing;

-- Retirar.
delete from public.user_roles ur
using public.profiles p, public.roles r
where ur.user_id = p.user_id and ur.role_id = r.id
  and p.email = 'alguien@ejemplo.com' and r.name = 'admin';

-- Ver quién tiene qué.
select p.email, array_agg(r.name order by r.name) as roles
from public.profiles p
left join public.user_roles ur using (user_id)
left join public.roles r on r.id = ur.role_id
group by 1 order by 1;
```

> **Un administrador necesita además el rol `student`.** La vista de aprendizaje exige ese rol, así
> que quien solo tenga `admin` no puede abrir el contenido que administra — ni siquiera para
> comprobar cómo se ve. Al conceder `admin` a alguien, conceder los dos. La migración que creó la
> tabla ya lo hizo con los usuarios que existían entonces, pero no puede hacerlo con los futuros.

## Sobre publicar este esquema

Estos archivos describen la estructura y las reglas de acceso, no credenciales. El acceso lo controla la RLS del lado del servidor: sin una sesión válida no se puede leer ni escribir nada, y con una sesión válida se puede exactamente lo que el rol permita, ni más ni menos. Conocer el esquema no da ninguna capacidad adicional.

Lo que sí debe permanecer fuera del repositorio es `supabase/.env`, que contiene `GEMINI_API_KEY` y está en `.gitignore`.
