# FronTTor

Tutor inteligente para aprender tecnologías _frontend_ (HTML, CSS, JavaScript y fundamentos de
_frameworks_), con un modelo de lenguaje que explica, orienta y genera práctica sin entregar nunca
la solución.

**Aplicación desplegada:** <https://fronttor.vercel.app>

Proyecto desarrollado como trabajo de grado del programa de Ingeniería de Sistemas de la
Universidad del Valle (Cali, 2026), dirigido por el profesor Oscar Fernando Bedoya y codirigido por
el profesor Mauricio Gaona.

---

## Qué hace

**Para el estudiante**

- **Aprender:** un curso organizado en temas y subtemas, con bloques de teoría en Markdown que se
  desbloquean en orden, y un chat con el tutor que responde a partir del contenido del subtema.
- **Ejercicios:** se resuelven escribiendo HTML, CSS y JavaScript en un editor con vista previa y
  consola. Al enviar, cada criterio del ejercicio se comprueba en el navegador; si el envío falla,
  el estudiante puede pedir una pista al tutor, que lo orienta sin darle la solución.
- **Práctica libre y guiada:** un editor para experimentar sin calificación, con el chat del tutor
  sobre el propio código, y la generación de ejercicios de práctica sobre el subtema y la
  dificultad que el estudiante elija.
- **Inicio:** el siguiente paso del recorrido, el avance por tema, los ejercicios en los que se ha
  atascado y su actividad con el tutor.
- **Perfil:** una descripción de sí mismo que el tutor tiene en cuenta en sus respuestas.

**Para el profesor**

- **Enseñar:** crear, editar, reordenar, publicar y eliminar temas, subtemas, bloques y
  ejercicios, con borradores redactados por el modelo de lenguaje y un diagnóstico que comprueba
  los criterios de cada ejercicio contra su solución y su código inicial antes de publicarlo.

### El papel del modelo de lenguaje

El modelo explica; no corrige. Si un ejercicio está aprobado lo deciden sus criterios, que se
comprueban de forma determinista en un `iframe` aislado, sin intervención del modelo. Gemini
interviene en el chat, en las pistas, en la práctica guiada y en los borradores del profesor, y las
funciones del estudiante reciben su perfil y su progreso para ajustar el nivel, los ejemplos y el
tono de la respuesta.

---

## Tecnologías

| Capa               | Tecnologías                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------- |
| _Frontend_         | Angular 21, TypeScript, RxJS, PrimeNG, Monaco Editor, ngx-markdown                          |
| _Backend_ y datos  | Supabase: PostgreSQL con RLS y funciones RPC, Supabase Auth y _Edge Functions_ (Deno)       |
| Modelo de lenguaje | Google Gemini (`gemini-3.5-flash-lite` para chat y pistas; `gemini-3.6-flash` para generar) |
| Calidad y pruebas  | ESLint, Prettier, Husky, lint-staged, Jasmine y Karma, Compodoc                             |
| Despliegue         | Vercel (_frontend_) y Supabase (base de datos, autenticación y funciones)                   |

---

## Estructura del repositorio

```
src/app/
  core/        Guards, servicios de sesión y cliente de Supabase
  domain/      Lógica de negocio y acceso a datos: aprendizaje, ejecución de código e IA
  features/    Una carpeta por sección: auth, home, learning, playground, profile, teaching
  shared/      Componentes y layouts reutilizados (editor, vista previa, consola, chat, barras)
supabase/
  schema-actual.sql, migrations/, seed.sql   Esquema, políticas y datos semilla
  functions/                                 Edge Functions y sus prompts
```

---

## Montar una instancia propia

FronTTor se distribuye bajo la licencia MIT, así que puede usarse y adaptarse libremente. Para
montarlo hacen falta un proyecto propio de Supabase y una clave propia de la API de Gemini.

**Requisitos:** Node.js 20.19 o posterior (o cualquier versión LTS compatible con Angular 21), npm,
una cuenta de [Supabase](https://supabase.com) y una clave de la
[API de Gemini](https://ai.google.dev).

1. **Clonar e instalar.**

   ```bash
   git clone https://github.com/JuanC513/fronttor.git
   cd fronttor
   npm install
   ```

2. **Crear el proyecto de Supabase** y aplicar el esquema, las migraciones y los datos semilla en
   el orden que indica [`supabase/README.md`](supabase/README.md). El orden importa: cada paso
   depende de los anteriores.

3. **Configurar la autenticación** en el panel de Supabase (**Authentication → URL
   Configuration**): agregar como URL de redirección la dirección donde correrá la aplicación,
   por ejemplo `http://localhost:4200/**`. Para entrar con Google, activar además el proveedor de
   Google con credenciales OAuth propias.

4. **Desplegar las Edge Functions** con la clave de Gemini como secreto del proyecto:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase secrets set GEMINI_API_KEY=<tu-clave>
   npx supabase functions deploy
   ```

5. **Apuntar el _frontend_ a tu proyecto:** en `src/environments/environment.ts` y
   `environment.prod.ts`, reemplazar `supabaseUrl` y `supabaseAnonKey` por la URL y la clave
   _publishable_ de tu proyecto (**Project Settings → API**). Esa clave está pensada para ir en el
   navegador: lo que protege los datos son las políticas de seguridad de la base.

6. **Ejecutar:**

   ```bash
   npm start
   ```

   La aplicación queda en `http://localhost:4200`.

7. **Crear el primer profesor.** Toda cuenta nueva recibe el rol de estudiante. El de profesor se
   concede desde el **SQL Editor** de Supabase, como se explica en la sección «Conceder roles» de
   [`supabase/README.md`](supabase/README.md). A partir de ahí, el contenido del curso se crea desde
   la sección Enseñar.

---

## Desarrollo

| Comando              | Qué hace                                                  |
| -------------------- | --------------------------------------------------------- |
| `npm start`          | Servidor de desarrollo                                    |
| `npm run build`      | _Build_ de producción                                     |
| `npm test`           | Pruebas unitarias con Karma y Jasmine                     |
| `npm run lint`       | ESLint                                                    |
| `npm run format`     | Formatea el código con Prettier                           |
| `npm run check`      | Lint, formato y sincronía de los límites de los _prompts_ |
| `npm run docs:serve` | Genera la documentación técnica con Compodoc y la sirve   |

Antes de cada _commit_, Husky y lint-staged ejecutan ESLint y Prettier sobre los archivos en
_stage_; si alguno falla, el _commit_ se detiene hasta corregirlo.

---

## Licencia

[MIT](LICENSE) © 2026 Juan Esteban Clavijo García
