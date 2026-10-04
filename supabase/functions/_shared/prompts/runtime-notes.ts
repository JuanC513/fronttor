/**
 * Cómo se ejecuta el código del estudiante en la plataforma.
 *
 * ## Por qué esto vive aquí y no dentro de un prompt
 *
 * Este bloque nació dentro de `exercise-prompt.ts`, que lo necesitaba para no redactar consignas
 * imposibles —pedir un `<head>` cuando el HTML se inserta dentro del `<body>`—. Ahí funcionó, y ahí
 * se quedó: los otros cuatro prompts nunca lo recibieron.
 *
 * El precio se cobró en producción. Un estudiante preguntó en el taller cómo hacer que su botón
 * llamara a una función suya, y el tutor le respondió lo que es correcto en la web abierta:
 * `onclick="pedirAyuda()"`. Aquí eso **no puede funcionar** —el JS corre dentro de una función y no
 * deja nada en el ámbito global—, así que recibió un `ReferenceError`. Al insistir, el tutor le
 * mandó a revisar que su `<script src>` estuviera bien enlazado: un archivo que no existe, en un
 * servidor que no existe.
 *
 * La respuesta correcta estaba escrita, palabra por palabra, en un archivo de al lado.
 *
 * Por eso está en un módulo propio: mientras el conocimiento viva dentro de un prompt, cada prompt
 * nuevo repite la omisión.
 *
 * ## Los hechos están separados de sus consecuencias
 *
 * `HECHOS` es lo que el motor hace, y es lo único que hay que mantener al día si el motor cambia
 * (ver `validation-harness.ts` en el frontend, que es quien arma el documento). Lo que cada prompt
 * añade son las consecuencias para su oficio, que no son las mismas: a quien **escribe** un
 * ejercicio hay que decirle qué no puede pedir, y a quien **aconseja** a un estudiante, qué no
 * puede recomendarle.
 */

/** Lo que el motor hace. Comprobado en el taller, no deducido del código. */
const HECHOS = `- El estudiante NO trabaja con archivos. Escribe en tres pestañas de un mismo editor (HTML, CSS y JS) que se ejecutan JUNTAS en una sola página. No hay servidor, ni sistema de archivos, ni nada que enlazar.
- El HTML se inserta dentro de <body>, el CSS en una etiqueta <style>, y el JS se ejecuta al final, cuando el HTML ya está puesto en la página.
- El JS corre DENTRO de una función. Lo que declare ahí —funciones, var, let, const— NO queda en el ámbito global ni en window.
- No hay red, ni librerías, ni frameworks, ni npm. Solo HTML, CSS y JavaScript del navegador.`;

/**
 * Para los prompts que **generan** material (ejercicios, contenido): qué no tiene sentido pedir.
 */
export const RUNTIME_NOTES_AUTORIA = `CÓMO SE EJECUTA EL CÓDIGO (afecta a lo que puedes pedir):
${HECHOS}
- Por eso NO existe el documento completo: nada de <!DOCTYPE>, <html>, <head>, <title> ni <meta>. Escribir o pedir esas etiquetas no tiene sentido aquí; el HTML empieza directamente por el contenido visible.
- No plantees nada que dependa de llamar a una función del estudiante por su nombre desde fuera del JS, porque no se podrá.`;

/**
 * Para los prompts que **aconsejan** a un estudiante sobre su propio código: qué no se le puede
 * recomendar, y cuál es la alternativa que sí funciona.
 *
 * Cada punto responde a un consejo real que el tutor llegó a dar y que el estudiante no pudo seguir.
 */
export const RUNTIME_NOTES_TUTORIA = `CÓMO SE EJECUTA EL CÓDIGO (afecta a lo que puedes aconsejar):
${HECHOS}
- NUNCA le digas que enlace archivos: <script src="...">, <link rel="stylesheet">, type="module" o import no existen aquí y no pueden funcionar. Tampoco le mandes a comprobar "si el archivo está bien enlazado": no hay ningún archivo que enlazar, y buscar ahí le hace perder el tiempo.
- Un onclick="miFuncion()" escrito en el HTML NO alcanza a una función declarada en la pestaña JS: el atributo se evalúa en el ámbito global, y ahí esa función no está. Si el estudiante quiere conectar un botón, tiene dos caminos correctos: usar addEventListener desde la pestaña JS (es el que conviene recomendar), o, si insiste en onclick, colgar la función del objeto global con window.miFuncion = function () { ... }.
- El JS se ejecuta con el HTML ya puesto en la página, así que document.getElementById(...) funciona directamente en el nivel superior. No hace falta envolverlo en DOMContentLoaded.
- Un <script> escrito dentro de la pestaña HTML sí corre en el ámbito global, pero sus console.log NO aparecen en la consola de la plataforma. No lo propongas como solución.`;

/**
 * Para el chat de la lección, donde no hay código a la vista.
 *
 * Es corto a propósito. Ahí el estudiante está aprendiendo la web de verdad, y en la web de verdad
 * `<script src>` **es** la respuesta correcta: no se le puede desenseñar. Lo único que hace falta es
 * que el tutor no le mande a crear archivos cuando lo que pregunta es cómo probar algo aquí.
 */
export const RUNTIME_NOTE_BREVE = `NOTA SOBRE LA PLATAFORMA: cuando el estudiante practica código, no escribe archivos: usa un editor de tres pestañas (HTML, CSS y JS) que se ejecutan juntas en una sola página. Enseña cómo se hace en la web real cuando esa sea la duda, pero si te pregunta cómo probar algo en la plataforma, no le mandes a crear ni a enlazar archivos.`;
