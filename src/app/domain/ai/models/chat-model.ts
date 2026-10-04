import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';

/**
 * Lo que toda conversación necesita, venga de donde venga.
 */
interface ChatContextBase {
  /**
   * Identifica la conversación. Mientras no cambie, el historial se conserva aunque el
   * resto del contexto se actualice; al cambiar, la conversación se descarta.
   */
  key: string;
  /** Primer mensaje que ve el estudiante al abrir. Se arma en el cliente, sin llamar al modelo. */
  saludo: string;
  /** Texto del campo de escritura. Lo pone la vista: en una lección y en el taller no es el mismo. */
  placeholder: string;
}

/** Una duda mientras se lee un subtema. El material de la plataforma es la fuente de la respuesta. */
export interface LessonChatContext extends ChatContextBase {
  tipo: 'leccion';
  /** Id del subtema. No se usa en el prompt: viaja para que la interacción quede registrada. */
  lessonId: number;
  tema: string;
  subtema: string;
  nombreBloque?: string;
  /** Markdown del bloque que el estudiante está viendo. */
  contenidoBloque?: string;
}

/**
 * Una duda sobre el código que el estudiante tiene escrito delante.
 *
 * El código llega como función y no como valor, y es a propósito. La alternativa —volver a publicar
 * el contexto cada vez que cambia el editor— escribiría una señal en cada pulsación solo para que
 * el chat estuviera al día por si acaso. Así la vista publica una vez y `send()` lee el código en
 * el momento de preguntar, que además es la semántica que se quiere: el tutor ve lo que hay en el
 * editor cuando pulsas enviar.
 *
 * Las señales de Angular ya son funciones `() => T`, así que una vista puede pasar la suya tal cual.
 */
export interface CodeChatContext extends ChatContextBase {
  tipo: 'codigo';
  obtenerCodigo: () => CodeRunnerState;
  obtenerConsola: () => string[];
}

/**
 * Contexto que una vista aporta al chat para que el tutor sepa de qué se está hablando.
 *
 * Es una unión y no una sola forma con campos opcionales porque las dos no se diferencian solo en
 * qué traen, sino en **cuánto se fía el modelo de lo que traen**: el contenido de una lección es
 * material curricular de la plataforma, y el código de un estudiante es texto que él escribió. Cada
 * una acaba en un prompt distinto, y el discriminante es lo que decide en cuál.
 */
export type ChatContext = LessonChatContext | CodeChatContext;

export interface ChatMessage {
  id: string;
  rol: 'estudiante' | 'tutor';
  texto: string;
}
