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
4. `seed.sql`

El orden entre 2 y 3 **no es opcional**: la segunda migración usa la función `is_admin()`, que crea la primera.

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
- **El secreto de las Edge Functions.** Volver a configurar `GEMINI_API_KEY`.
- **Las Edge Functions.** `npx supabase functions deploy` apuntando al proyecto nuevo.

### En un proyecto que ya tiene datos

Esto es lo que importa antes de ejecutar nada:

| Tabla                                                     | Efecto                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `auth.users`                                              | **Intacta.** Ninguna migración la toca.                      |
| `profiles`                                                | **Datos intactos.** Solo cambian sus permisos y políticas.   |
| `roles`                                                   | **Datos intactos.** `seed.sql` usa `on conflict do nothing`. |
| `modules`, `lessons`, `blocks`                            | **Datos intactos.** Solo cambian sus políticas.              |
| `exercises`                                               | **Se borra y se recrea.** Sus filas se pierden.              |
| `exercise_attempts`, `lesson_progress`, `ai_interactions` | Se crean si no existen; si ya existen, se conservan.         |

Es decir: las cuentas de usuario y su asociación con los roles **no se pierden**, ni tampoco el contenido del curso. La única tabla cuyos datos desaparecen es `exercises`.

### Reejecutar

- **`20260818130000_content_and_profile_policies.sql` es seguro de reejecutar** cuantas veces haga falta: solo declara políticas y permisos, y cada uno va precedido de su `drop ... if exists`.

- **`20260818120000_exercises_attempts_progress.sql` está pensado para aplicarse una vez.** Reejecutarlo sobre una base con ejercicios cargados no solo los borra: el `drop table exercises cascade` se lleva por delante las claves foráneas que `exercise_attempts` y `ai_interactions` tienen hacia esa tabla, y como esas dos se crean con `create table if not exists`, al ya existir no se vuelven a crear y sus claves foráneas no se restauran. El resultado son intentos apuntando a ejercicios que ya no existen, sin nada que lo impida.

  Si hace falta reaplicarla con datos cargados, ejecutar solo desde la sección 2 en adelante, saltándose la creación de `exercises`.

- **`seed.sql` es seguro de reejecutar.**

## Comprobación

Después de aplicar, con un JWT de estudiante estas cuatro deben fallar o afectar 0 filas:

```sql
insert into modules (name, "order") values ('prueba', 99);
update  blocks   set content = 'prueba' where id = 1;
delete  from lessons where id = 1;
update  profiles set role_id = 2 where user_id = auth.uid();
```

Y con sesión de administrador, el panel debe seguir funcionando completo: crear, editar, reordenar y borrar temas, subtemas y bloques.

## Sobre publicar este esquema

Estos archivos describen la estructura y las reglas de acceso, no credenciales. El acceso lo controla la RLS del lado del servidor: sin una sesión válida no se puede leer ni escribir nada, y con una sesión válida se puede exactamente lo que el rol permita, ni más ni menos. Conocer el esquema no da ninguna capacidad adicional.

Lo que sí debe permanecer fuera del repositorio es `supabase/.env`, que contiene `GEMINI_API_KEY` y está en `.gitignore`.
