export interface ChatTurn {
  rol: 'estudiante' | 'tutor';
  texto: string;
}

export interface AnswerQuestionRequest {
  contenidoLeccion: string;
  pregunta: string;
  tema?: string;
  subtema?: string;
  nombreBloque?: string;
  /** Turnos previos, del más antiguo al más reciente. El servidor recorta a los últimos 6. */
  historial?: ChatTurn[];
}

export interface AnswerQuestionResponse {
  respuesta: string;
}
