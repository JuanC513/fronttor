import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';

/** Un turno de la conversación con el tutor, en cualquiera de los dos sentidos. */
export interface ChatTurn {
  /** Quién habló. */
  rol: 'estudiante' | 'tutor';

  /** El texto del turno, tal cual. */
  texto: string;
}

/** Lo que comparten las dos formas de preguntar, sea sobre una lección o sobre código. */
interface QuestionRequestBase {
  /** Lo que el estudiante escribió. Es contenido no confiable para el prompt. */
  pregunta: string;
  /** Turnos previos, del más antiguo al más reciente. El servidor recorta a los últimos 6. */
  historial?: ChatTurn[];
}

/** Una duda sobre el subtema que se está leyendo. */
export interface LessonQuestionRequest extends QuestionRequestBase {
  /** Discriminante: la duda es sobre el contenido que se está leyendo. */
  modo: 'leccion';
  /** No entra en el prompt: es para que la interacción quede registrada con su subtema. */
  lessonId?: number;

  /** El texto del subtema abierto. Es el material sobre el que el tutor puede responder. */
  contenidoLeccion: string;

  /** Nombre del módulo, para situar la respuesta. */
  tema?: string;

  /** Nombre del subtema. */
  subtema?: string;

  /** Bloque concreto que el estudiante tenía delante al preguntar. */
  nombreBloque?: string;
}

/** Una duda sobre el código que el estudiante tiene escrito en el taller. */
export interface CodeQuestionRequest extends QuestionRequestBase {
  /** Discriminante: la duda es sobre el código del taller. */
  modo: 'codigo';

  /** Las tres pestañas tal y como las tiene escritas. Contenido no confiable. */
  codigo: CodeRunnerState;
  /** Salida de la consola del taller. Es donde está el error cuando algo falla en tiempo de ejecución. */
  consola?: string[];
}

/**
 * Lo que viaja a `answer-question`.
 *
 * El `modo` viaja siempre desde aquí, pero el servidor lo trata como opcional con `'leccion'` por
 * defecto: la función y el frontend no se despliegan a la vez, y una pestaña abierta sigue con el
 * bundle viejo.
 */
export type AnswerQuestionRequest = LessonQuestionRequest | CodeQuestionRequest;

/** Lo que devuelve `answer-question`. */
export interface AnswerQuestionResponse {
  /** La respuesta del tutor, en Markdown. */
  respuesta: string;
}
