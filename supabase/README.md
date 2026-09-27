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
10. `migrations/20260921120000_rename_admin_to_teacher.sql`
11. `migrations/20260922120000_attempt_feedback.sql`
12. `migrations/20260926120000_hide_exercise_solution.sql`
13. `migrations/20260926130000_ai_interactions_failures.sql`
14. `migrations/20260927120000_student_context.sql`
15. `migrations/20260927130000_student_error_patterns.sql`
16. `migrations/20260928120000_close_anon_grants.sql`
17. `migrations/20260929120000_enforce_lesson_order.sql`
18. `migrations/20260930120000_content_publication_rls.sql`
19. `seed.sql`

El orden **no es opcional**: la 3 usa la función `is_admin()`, que crea la 2; la 4 redefine funciones que crea la 2; la 5 redefine las que deja la 4; la 6 redefine `is_admin()` y `handle_new_user()`, la 7 depende de esa última, la 10 renombra `is_admin()` a `is_teacher()` junto con el rol y las políticas, y la 11 recrea `submit_exercise_attempt`, que existe desde la 2. La 12 usa `is_teacher()`, que deja la 10; la 14 lee `lesson_progress` y `exercise_attempts`, que crea la 2, y `profiles.profile_description`, que la 8 dejó como la única columna editable del propio perfil; y la 15 recrea `get_student_context()`, que crea la 14.

La 18 reemplaza policies que declaran la 3 y la 12, así que va después de las dos.

La 17 recrea `mark_lesson_viewed` —que viene de la 4— y `submit_exercise_attempt` —de la 11—, así que
va después de las dos. Y va **después de la 16** por un motivo concreto: crea una función nueva, y
desde la 16 las funciones nuevas nacen sin permisos, de modo que su `grant execute` explícito es
obligatorio. Es la primera migración escrita bajo esa regla.

**La 16 va después de las que crean objetos**, y no por dependencia sino por alcance: revoca permisos sobre *todas* las funciones y secuencias del esquema, así que tiene que ver ya creado todo lo que las anteriores crean. También después de la 1, porque `schema-actual.sql` trae consigo las concesiones a `anon` y el `ALTER DEFAULT PRIVILEGES` que las reintroduce.

Y la 1 **no es opcional en un proyecto nuevo**: seis funciones que la aplicación llama —`delete_module`, `delete_lesson`, `delete_block`, `reorder_modules`, `reorder_lessons` y `reorder_blocks`— se crearon en el dashboard y no las crea ninguna migración, así que solo llegan por ahí. Sin ellas el panel de profesor falla al borrar y al reordenar.

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
- **El primer profesor.** Todo el que se registra nace con el rol `student` y nada más. El primer `teacher` se concede a mano (ver más abajo).
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

- **`20260921120000_rename_admin_to_teacher.sql` es seguro de reejecutar.** Renombra las políticas y
  la función solo si todavía tienen el nombre viejo, y el `update` del catálogo no hace nada en la
  segunda pasada.

- **`20260922120000_attempt_feedback.sql` es seguro de reejecutar.** Suelta y recrea las dos
  funciones con `drop function if exists`, y los revoke/grant son idempotentes por naturaleza.

  Es la única migración que **suelta una función que ya estaba en uso**: `submit_exercise_attempt`
  pasa de `returns void` a `returns integer`, y `create or replace` no puede cambiar el tipo de
  retorno. Es seguro porque esa función no tiene dependientes —ninguna política, vista ni trigger la
  nombra—, a diferencia de `is_admin()` en la 10, donde el `drop` se habría llevado por delante 15
  políticas. Al soltarla se pierden sus permisos, y por eso la migración los vuelve a conceder.

  **Después de aplicarla hay que redesplegar las Edge Functions**, porque el cliente de Angular pasa
  a esperar el id del intento.

- **`20260926120000_hide_exercise_solution.sql` es seguro de reejecutar.** Revoca y concede permisos
  de columna, y crea `get_exercise_for_edit()` con `create or replace`. La política va precedida de su
  `drop policy if exists`.

- **`20260926130000_ai_interactions_failures.sql` es seguro de reejecutar.** Añade las tres columnas
  y el índice parcial con `if not exists`.

- **`20260927120000_student_context.sql` es seguro de reejecutar.** Solo crea una función con
  `create or replace` y ajusta sus permisos.

- **`20260927130000_student_error_patterns.sql` es seguro de reejecutar.** Añade un índice con
  `if not exists` y recrea la misma función de la anterior. **Es la versión que queda**: reaplicar la
  14 después de la 15 deja la función sin los patrones de error, así que si se reaplica una, se
  reaplican las dos en orden.

- **`20260928120000_close_anon_grants.sql` es seguro de reejecutar.** `revoke` y
  `alter default privileges` son idempotentes por naturaleza.

  Con esta migración aplicada, **reejecutar cualquiera de las anteriores ya no reabre nada**: las que
  sueltan y recrean funciones (la 4, la 5 y la 11) las verán nacer sin permisos para `anon`, y cada
  una concede a `authenticated` lo que necesita de forma explícita. Eso es justamente lo que esta
  migración viene a garantizar.

- **`20260929120000_enforce_lesson_order.sql` es seguro de reejecutar.** Crea una función y recrea
  otras dos con `create or replace`, todas con la misma firma, así que no hay que soltar nada y los
  permisos se conservan.

  Cambia un caso de borde que conviene conocer: **un subtema publicado pero sin bloques publicados
  deja de registrar progreso.** Antes `mark_lesson_viewed` solo miraba `is_published`; ahora exige que
  el subtema sea parte del recorrido, y el recorrido descarta lo que no tiene nada que leer —igual que
  hace el cliente en `orderedLessons`—.

- **`20260930120000_content_publication_rls.sql` es seguro de reejecutar.** Solo declara policies, y
  cada una va precedida de su `drop policy if exists`.

  Reemplaza `exercises_select_published_or_teacher`, que creó la 12: aquella solo miraba el
  `is_published` del propio ejercicio, y esta mira además su subtema y su tema.

- **`seed.sql` es seguro de reejecutar.**

## Comprobación

### Lo que no puede hacer un estudiante

Después de aplicar, con un JWT de estudiante estas cuatro deben fallar o afectar 0 filas:

```sql
insert into modules (name, "order") values ('prueba', 99);
update  blocks   set content = 'prueba' where id = 1;
delete  from lessons where id = 1;
insert into user_roles (user_id, role_id) values (auth.uid(), 2);
```

La cuarta es la que impide que alguien se conceda el rol de profesor a sí mismo. Antes era
`update profiles set role_id = 2`, y lo que la bloqueaba eran los permisos de columna de `profiles`;
desde que el rol vive en `user_roles` lo bloquean el `revoke` de esa tabla y su RLS. **Conviene
leer el texto del error**: debe decir `permission denied for table user_roles`. Si dice
`violates row-level security policy`, el `revoke` no se aplicó y solo queda una de las dos capas.

Y con sesión de profesor, el panel debe seguir funcionando completo: crear, editar, reordenar y borrar temas, subtemas y bloques.

### Sobrecargas de las RPC de contenido

Ninguna RPC de contenido puede haber quedado duplicada por una sobrecarga. Esta consulta debe devolver exactamente ocho filas:

```sql
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('insert_module','update_module','insert_lesson','update_lesson',
                  'insert_block','update_block','insert_exercise','update_exercise')
order by proname;
```

Si sale alguna repetida, el panel fallará al guardar con *"Could not choose the best candidate function"*.

### Lo que puede ejecutar `anon`

Desde `20260928120000`, nada. Esta consulta debe devolver **cero filas**:

```sql
select p.oid::regprocedure as funcion
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and has_function_privilege('anon', p.oid, 'execute')
order by 1;
```

`has_function_privilege` responde «¿puede `anon` ejecutarla?» sin importar si el permiso le llega
directo o heredado de `PUBLIC`, que son los dos caminos del problema. Antes de aplicar la migración
devolvía las 24 funciones del esquema.

La misma con `authenticated` debe devolver las RPC que usa la aplicación, y **no** puede incluir
`recompute_lesson_progress`, que es interna y no se concede a nadie.

> Buscando `anon` en `schema-actual.sql` aparece **una** línea, y es la que debe aparecer:
> `GRANT USAGE ON SCHEMA "public" TO "anon"`. Se deja a propósito: quitarla dejaría al rol sin poder
> resolver nada en el esquema, y no hace falta, porque lo que de verdad da acceso son los permisos
> sobre cada objeto, que sí están cerrados.

Las secuencias, también cero filas:

```sql
select c.relname, a.privilege_type
from pg_class c
cross join lateral aclexplode(c.relacl) a
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'S'
  and a.grantee::regrole::text = 'anon';
```

> Aquí se lee el ACL en crudo en vez de llamar a `has_sequence_privilege`, y no es por gusto. Con la
> función, PostgreSQL falla con `42809: "saml_providers_pkey" is not a sequence`: el planificador
> puede evaluar las condiciones del `WHERE` **en cualquier orden**, así que aplica la función a filas
> de `pg_class` que no son secuencias antes de llegar al filtro de `relkind`. Reordenar la consulta no
> lo arregla, porque ese orden no se puede imponer; lo que lo arregla es no usar una función que pueda
> lanzar.

### Publicado significa publicado en toda la cadena

Desde `20260930120000`, un estudiante solo puede leer contenido cuya cadena entera esté publicada: un
subtema necesita que su tema lo esté, y un bloque o un ejercicio que lo estén su subtema y su tema. El
profesor lo ve todo, que es la primera rama de cada policy.

Antes, el filtro existía solo en `exercises` y solo sobre su propia fila. **Con una cuenta de
estudiante se podían leer por la API** el nombre de un tema sin publicar, los nombres de sus subtemas
—que sí estaban publicados— y el contenido completo de un bloque en borrador. No se veía en la
aplicación porque `getLearningTree` filtra por su cuenta; es decir, filtraba la vista y no la base.

Se comprueba con **una sesión de estudiante**, sobre el borrador que ya exista en la base. Con el tema
sin publicar en `modules`, estas tres deben devolver **cero filas**:

```sql
select * from modules  where not is_published;
select * from lessons  where module_id = <id del tema sin publicar>;
select * from blocks   where not is_published;
```

La segunda es la que importa: esos subtemas **están publicados**, y lo que debe esconderlos es su
tema. Si devuelve filas, la policy está mirando solo el `is_published` propio.

Y con la misma sesión, lo que sí tiene que seguir viéndose: los temas publicados con sus subtemas, los
bloques del subtema que esté abierto, y los ejercicios publicados.

> **Cuidado con la recursión si algún día se toca esto.** La policy de `blocks` consulta `lessons`, y
> la de `lessons` consulta `modules`. La subconsulta de una policy pasa por la RLS de la tabla que
> consulta, así que la cadena se evalúa anidada — funciona porque `modules` no consulta a nadie. Una
> policy nueva en `modules` que mirase a `lessons` cerraría el ciclo, y PostgreSQL respondería con
> recursión infinita en cada lectura de contenido.

### El recorrido no se puede saltar

Desde `20260929120000` el orden del recorrido lo impone la base, no la vista. Las dos RPC que crean
filas en `lesson_progress` —`mark_lesson_viewed` y `submit_exercise_attempt`— preguntan antes a
`lesson_is_reachable()`.

Con una sesión de estudiante, sobre un subtema que todavía no le toca, las dos deben responder
`42501 Este subtema todavia no esta disponible`, y `lesson_progress` no debe ganar ninguna fila:

```sql
select public.mark_lesson_viewed(<id de un subtema bloqueado>);
select count(*) from lesson_progress where user_id = auth.uid();
```

Y `lesson_is_reachable()` tiene que coincidir con lo que pinta la vista de Contenido:

```sql
select l.id, l.name, public.lesson_is_reachable(l.id) as alcanzable
from lessons l
join modules m on m.id = l.module_id
where l.is_published and m.is_published
order by m."order", l."order";
```

`true` en los que la vista muestra abiertos, `false` en los bloqueados y **`null` en los que no son
parte del recorrido** —sin publicar, o sin un solo bloque publicado—. Si alguna fila discrepa de la
vista, es que la regla de `learning-progress.ts` y la del SQL se han separado, y hay que cuadrarlas:
son dos implementaciones de la misma cosa a propósito, porque una pinta el candado y la otra lo
sostiene.

> Lo que esto **no** hace es validar el mérito de cada paso. `passed` sigue viniendo del cliente, así
> que un estudiante puede autoaprobarse los ejercicios de su subtema actual; lo que ya no puede es
> hacerlo en un subtema al que no ha llegado. Cerrar eso exige que la Edge Function escriba con
> `service_role`, y está documentado en `exercise-attempt-model.ts`.

### El privilegio por defecto, que es lo que evita la reincidencia

```sql
select pg_get_userbyid(d.defaclrole) as dueno_de_los_defaults,
       case d.defaclobjtype
         when 'r' then 'tablas'
         when 'S' then 'secuencias'
         when 'f' then 'funciones'
         when 'T' then 'tipos'
         when 'n' then 'esquemas'
         else d.defaclobjtype::text
       end                                    as sobre,
       case when a.grantee = 0 then 'PUBLIC'
            else a.grantee::regrole::text end  as rol,
       string_agg(a.privilege_type, ', ' order by a.privilege_type) as privilegios
from pg_default_acl d
cross join lateral aclexplode(d.defaclacl) a
where d.defaclnamespace = 'public'::regnamespace
group by 1, 2, 3
order by 1, 2, 3;
```

**La columna del dueño no es un adorno, es lo que hace legible el resultado.** Lo esperado son dos
bloques distintos:

| Dueño | Qué debe salir |
| ----- | -------------- |
| `postgres` | `authenticated`, `postgres` y `service_role`, y **ni `anon` ni `PUBLIC`** en ninguna de las tres categorías |
| `supabase_admin` | `anon` sí aparece, y es correcto que aparezca |

`postgres` es el único que importa: el editor SQL corre con `current_user = postgres`, de modo que es
el rol con el que este proyecto crea todo lo que hay en `public`. La entrada de `supabase_admin` es
de la plataforma y no se toca —`alter default privileges for role supabase_admin` desde `postgres` se
niega por permisos, y si no se negara sería peor—; queda ahí como vigilancia, por si algún día
apareciera en `public` un objeto creado con ese rol.

> **Regla para cada migración nueva.** Desde `20260928120000`, una función recién creada **no es
> ejecutable por nadie** salvo su dueño, así que necesita su línea explícita:
>
> ```sql
> grant execute on function public.lo_que_sea(...) to authenticated;
> ```
>
> Si falta, la migración se aplica sin error y el fallo aparece al llamarla, con
> `42501 permission denied for function <nombre>`. PostgREST no filtra su caché de esquema por rol,
> así que deja pasar la llamada y es Postgres quien la niega — de modo que el error dice exactamente
> lo que pasa. Comprobado contra la base al aplicar la migración.

## Conceder roles

Un usuario puede tener varios roles a la vez, y la pertenencia vive en `user_roles`. **No se
administra desde la aplicación**: ni siquiera un profesor tiene permiso de escritura sobre esa
tabla a través de la API. Se hace desde el **SQL Editor**, que corre como `postgres` y no pasa por
la RLS.

```sql
-- Conceder. Es idempotente.
insert into public.user_roles (user_id, role_id)
select p.user_id, r.id
from public.profiles p, public.roles r
where p.email = 'alguien@ejemplo.com' and r.name = 'teacher'
on conflict do nothing;

-- Retirar.
delete from public.user_roles ur
using public.profiles p, public.roles r
where ur.user_id = p.user_id and ur.role_id = r.id
  and p.email = 'alguien@ejemplo.com' and r.name = 'teacher';

-- Ver quién tiene qué.
select p.email, array_agg(r.name order by r.name) as roles
from public.profiles p
left join public.user_roles ur using (user_id)
left join public.roles r on r.id = ur.role_id
group by 1 order by 1;
```

> **Un profesor necesita además el rol `student`.** La vista de aprendizaje exige ese rol, así
> que quien solo tenga `teacher` no puede abrir el contenido que escribe — ni siquiera para
> comprobar cómo se ve. Al conceder `teacher` a alguien, conceder los dos. La migración que creó la
> tabla ya lo hizo con los usuarios que existían entonces, pero no puede hacerlo con los futuros.

> **Sobre el nombre.** Hasta la migración 10 este rol se llamaba `admin`. Se renombró porque
> *administrador* nombra a quien gestiona el sistema —usuarios, permisos, parámetros— y no a quien
> escribe el contenido del curso. Las migraciones anteriores a la 10 siguen diciendo `admin`: son
> un registro fechado, no la descripción del estado actual.
>
> El nombre queda libre para lo que de verdad significa. Si alguna vez hace falta un rol de
> gestión de usuarios —por ejemplo, para que sea él quien conceda los roles en lugar de hacerlo
> desde aquí—, el catálogo `roles` y `has_role()` ya lo soportan sin tocar el esquema: bastaría
> `insert into roles (name) values ('admin')` y las políticas correspondientes.

## Sobre publicar este esquema

Estos archivos describen la estructura y las reglas de acceso, no credenciales. El acceso lo controla la RLS del lado del servidor: sin una sesión válida no se puede leer ni escribir nada, y con una sesión válida se puede exactamente lo que el rol permita, ni más ni menos. Conocer el esquema no da ninguna capacidad adicional.

Lo que sí debe permanecer fuera del repositorio es `supabase/.env`, que contiene `GEMINI_API_KEY` y está en `.gitignore`.
