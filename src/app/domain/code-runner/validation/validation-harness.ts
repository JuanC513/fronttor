import { CodeRunnerState } from '../models/code-runner-model';
import { Probe } from './probe-model';

/**
 * Documento que se carga en el iframe del previsualizador.
 *
 * El script que acompana al codigo del estudiante es **fijo**: solo sabe reenviar la consola y
 * responder sondas primitivas. Que no cambie al anadir tipos de criterio es justo el motivo de
 * separarlo asi (ver `probe-model.ts`).
 *
 * ## Por que el codigo del estudiante no puede falsificar el informe
 *
 * El JS del estudiante corre en este mismo documento, con acceso a los mismos globales, asi que
 * hay cuatro medidas que se refuerzan entre si:
 *
 * 1. **`runId` en un closure.** El padre lo genera y solo acepta informes que lo traigan. No viaja
 *    nunca hacia dentro por `postMessage`: si lo hiciera, el codigo del estudiante podria escuchar
 *    ese mensaje y contestar antes con un informe inventado.
 * 2. **El script se borra del DOM** antes de ejecutar nada del estudiante. Sin esto, bastaria un
 *    `document.body.innerHTML` para leer el `runId` del propio `<script>`.
 * 3. **Las funciones del DOM se capturan de antemano** y se invocan con `.call()`. Reemplazar
 *    `document.querySelectorAll` o `getComputedStyle` despues no afecta a las sondas.
 * 4. **`parent.postMessage` tambien se captura**, para que reemplazarlo no silencie el informe.
 *
 * Lo que queda sin cubrir es construir de verdad el DOM que los criterios describen, con JS en vez
 * de con HTML. Eso ya no es falsificar un resultado: es resolver el ejercicio de otra manera.
 *
 * @param code   HTML, CSS y JS que se van a ejecutar.
 * @param runId  Identificador de esta ejecucion.
 * @param probes Preguntas a responder, o `null` para una vista normal que no informa nada.
 */
export function buildPreviewDocument(
  code: CodeRunnerState,
  runId: string,
  probes: Probe[] | null,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
${code.css}
  </style>
</head>
<body>

${code.html}

<script>
(function () {
  var RUN_ID = ${JSON.stringify(runId)};
  var PROBES = ${JSON.stringify(probes)};
  var USER_JS = ${JSON.stringify(code.js)};

  // Todo lo que las sondas necesitan queda capturado antes de que el estudiante pueda tocarlo.
  // El padre se guarda como referencia y se invoca directamente: es una ventana de otro origen, y
  // sobre sus funciones no se pueden usar metodos como bind.
  var parentWindow = window.parent;
  var queryAll = document.querySelectorAll;
  var computedStyle = window.getComputedStyle;
  var getAttribute = Element.prototype.getAttribute;
  var getProperty = CSSStyleDeclaration.prototype.getPropertyValue;
  var getText = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get;
  var defer = window.setTimeout;

  // Sin esto, el codigo del estudiante podria leer el RUN_ID de este mismo script.
  if (document.currentScript) document.currentScript.remove();

  var logs = [];

  function post(type, payload) {
    parentWindow.postMessage({ type: type, runId: RUN_ID, payload: payload }, '*');
  }

  ['log', 'info', 'warn', 'error'].forEach(function (method) {
    console[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      var text = args
        .map(function (value) {
          return typeof value === 'string' ? value : String(value);
        })
        .join(' ');

      logs.push(text);
      post(method, [text]);
    };
  });

  window.onerror = function (message, source, lineno, colno) {
    post('runtime-error', { message: message, lineno: lineno, colno: colno });
    return true;
  };

  window.onunhandledrejection = function (event) {
    var reason = event.reason;
    post('runtime-error', { message: (reason && reason.message) || String(reason) });
    return true;
  };

  try {
    new Function(USER_JS)();
  } catch (error) {
    post('runtime-error', { message: error.message });
  }

  // Vista normal: no hay nada que informar. Un arreglo vacio si informa, porque un ejercicio
  // puede validarse solo con la consola y entonces no genera ninguna sonda.
  if (PROBES === null) return;

  // Se cede el turno para que terminen las tareas que el codigo del estudiante haya podido dejar
  // encoladas de forma inmediata. No se espera a un fotograma porque getComputedStyle ya fuerza el
  // recalculo de estilos por su cuenta, y en un iframe que no se pinta ese fotograma puede no
  // llegar nunca. Los cambios asincronos posteriores a este punto no se ven.
  defer(function () {
    var values = [];

    // Bucle indexado, sin map ni push: esos se ejecutan despues del codigo del estudiante, que
    // ya pudo haber reemplazado los metodos de Array.prototype.
    for (var i = 0; i < PROBES.length; i++) {
      values[i] = answer(PROBES[i]);
    }

    parentWindow.postMessage(
      { type: 'probe-report', runId: RUN_ID, values: values, logs: logs },
      '*'
    );
  }, 0);

  function answer(probe) {
    try {
      var matches = queryAll.call(document, probe.selector);

      if (probe.kind === 'count') {
        return { id: probe.id, found: true, value: matches.length };
      }

      var element = matches[0];
      if (!element) return { id: probe.id, found: false, value: null };

      if (probe.kind === 'text') {
        return { id: probe.id, found: true, value: getText.call(element) };
      }

      if (probe.kind === 'attribute') {
        return { id: probe.id, found: true, value: getAttribute.call(element, probe.attribute) };
      }

      var style = computedStyle.call(window, element);
      return { id: probe.id, found: true, value: getProperty.call(style, probe.property) };
    } catch (error) {
      // Un selector invalido hace que querySelectorAll lance. Es un error del criterio, no del
      // estudiante, y se traduce en un criterio que no se cumple.
      return { id: probe.id, found: false, value: null };
    }
  }
})();
</script>

</body>
</html>`;
}
