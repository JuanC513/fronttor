/**
 * Contrato entre el motor de validacion y el iframe donde corre el codigo.
 *
 * El iframe esta en `sandbox="allow-scripts"` sin `allow-same-origin`, asi que su origen es opaco
 * y desde Angular `iframe.contentDocument` es `null`: no hay forma de inspeccionar el DOM desde
 * fuera. Lo unico que cruza la frontera son mensajes.
 *
 * Por eso el reparto no es "el evaluador corre dentro". Dentro va una sonda **generica y fija**
 * que solo sabe responder cuatro preguntas primitivas sobre el documento; toda la logica de los
 * criterios (que sonda necesita cada tipo, como se compara, que texto ve el estudiante) se queda
 * en Angular, como codigo normal y comprobable sin DOM.
 *
 * La ventaja practica es que el script inyectado no cambia aunque manana se anadan tipos de
 * criterio: solo cambian las dos funciones puras que lo rodean.
 */

/** Pregunta primitiva que el iframe sabe responder. */
export type Probe =
  | { id: number; kind: 'count'; selector: string }
  | { id: number; kind: 'text'; selector: string }
  | { id: number; kind: 'attribute'; selector: string; attribute: string }
  | { id: number; kind: 'style'; selector: string; property: string };

/** Los cuatro tipos de sonda, derivados de la union para no repetir la lista. */
export type ProbeKind = Probe['kind'];

/**
 * Respuesta a una sonda.
 *
 * `found` distingue "el selector no encontro nada" de "lo encontro y el valor es vacio". Sin esa
 * distincion, un `attribute_equals` contra `''` aprobaria un elemento inexistente.
 */
export interface ProbeValue {
  /** Correlaciona la respuesta con la sonda que la pidio. */
  id: number;

  /** Si el selector encontro elemento. Ver la nota de arriba. */
  found: boolean;
  /** Numero para `count`, cadena para el resto, `null` si no se encontro el elemento. */
  value: string | number | null;
}

/** Lo que el iframe devuelve tras ejecutar el codigo y responder las sondas. */
export interface ProbeReport {
  /** Discriminante del mensaje, para filtrar lo que llega por `postMessage`. */
  type: 'probe-report';
  /**
   * Identificador de la ejecucion. Se incrusta en un closure del script al renderizar y nunca
   * viaja por `postMessage` hacia dentro: si el padre lo enviara, el codigo del estudiante podria
   * escuchar ese mensaje y responder antes con un informe inventado.
   */
  runId: string;

  /** Una respuesta por sonda enviada, en el mismo orden en que se pidieron. */
  values: ProbeValue[];
  /** Lo que el codigo del estudiante imprimio por consola, sin los adornos del panel. */
  logs: string[];
}

/** Resultado de un criterio, tal como lo ve el estudiante y como se guarda en `exercise_attempts`. */
export interface CriterionResult {
  /** El texto del criterio, el que aparece en «Que se comprueba». */
  description: string;

  /** Si el envio lo cumplio. */
  passed: boolean;
}

/** Lo que devuelve una validacion completa. */
export interface ValidationOutcome {
  /** Un resultado por criterio, en el orden del ejercicio. */
  results: CriterionResult[];
  /** Si el ejercicio queda aprobado. Un ejercicio sin criterios nunca lo esta. */
  passed: boolean;
  /**
   * El iframe no contesto a tiempo. Pasa con un bucle infinito en el codigo del estudiante, o si
   * el previsualizador volvio a renderizar a mitad de la validacion. Todos los criterios quedan
   * sin cumplir, pero conviene poder decir por que en vez de mostrar un fallo sin explicacion.
   */
  timedOut: boolean;
}
