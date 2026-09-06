# 🎓 Sistema Tutor Inteligente – Frontend

Aplicación frontend desarrollada en Angular como parte del Trabajo de Grado para la creación de un **Sistema Tutor Inteligente orientado a la enseñanza de temas de Frontend**.

El sistema busca integrar un modelo de Inteligencia Artificial para generar retroalimentación personalizada según el progreso del estudiante.

---

## 📌 Estado actual

El proyecto se encuentra en fase de configuración base y estandarización del entorno de desarrollo:

- ✅ Proyecto Angular inicializado
- ✅ ESLint configurado
- ✅ Prettier configurado
- ✅ Husky integrado
- ✅ lint-staged configurado
- ✅ Documentación automática con Compodoc
- ✅ Validación automática antes de commit

El objetivo actual es garantizar calidad, consistencia y escalabilidad desde el inicio del desarrollo.

---

## 🧠 Tecnologías

- Angular
- TypeScript
- ESLint
- Prettier
- Husky
- lint-staged
- Compodoc

---

## ⚙️ Requisitos

- Node.js (LTS recomendado)
- npm
- Angular CLI

Verificar versiones:

```bash
node -v
npm -v
ng version
```

---

## 🚀 Instalación

1. Clonar repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
cd <nombre-del-proyecto>
```

2. Instalar dependencias:

```bash
npm install
```

3. Ejecutar en desarrollo:

```bash
npm start
```

---

## 🔒 Control de calidad (Pre-commit)

El proyecto utiliza **Husky + lint-staged** para validar automáticamente los archivos antes de cada commit.

Al ejecutar:

```bash
git commit -m "mensaje"
```

Se ejecuta automáticamente:

- ESLint sobre archivos en stage
- Prettier sobre archivos en stage

Si hay errores:

- ❌ El commit falla
- Deben corregirse antes de continuar

Esto garantiza consistencia y calidad en todo el repositorio.

---

## 📚 Documentación

Se utiliza Compodoc para generar documentación técnica del proyecto.

Generar documentación:

```bash
npm run docs
```

Levantar servidor local de documentación:

```bash
npm run docs:serve
```

## 🗄️ Base de datos

El esquema de Supabase, sus políticas de acceso y los datos semilla viven en `supabase/`.

Para saber qué archivo aplicar, en qué orden y qué implica ejecutarlos sobre un proyecto
nuevo o sobre uno que ya tiene datos, ver [`supabase/README.md`](supabase/README.md).

---

## 👨‍💻 Autor

Proyecto desarrollado como Trabajo de Grado en Ingeniería de Sistemas.
