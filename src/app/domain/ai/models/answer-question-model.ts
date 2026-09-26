import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';

export interface ChatTurn {
  rol: 'estudiante' | 'tutor';
  texto: string;
}

interface QuestionRequestBase {
  pregunta: string;
  /** Turnos previos, del más antiguo al más reciente. El servidor recorta a los últimos 6. */
  historial?: ChatTurn[];
}

/** Una duda sobre el subtema que se está leyendo. */
export interface LessonQuestionRequest extends QuestionRequestBase {
  modo: 'leccion';
  /** No entra en el prompt: es para que la interacción quede registrada con su subtema. */
  lessonId?: number;

  contenidoLeccion: string;
  tema?: string;
  subtema?: string;
  nombreBloque?: string;
}

/** Una duda sobre el código que el estudiante tiene escrito en el taller. */
export interface CodeQuestionRequest extends QuestionRequestBase {
  modo: 'codigo';
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

export interface AnswerQuestionResponse {
  respuesta: string;
}
