/**
 * Contexto que una vista aporta al chat para que el tutor sepa de qué se está hablando.
 */
export interface ChatContext {
  /**
   * Identifica la conversación. Mientras no cambie, el historial se conserva aunque el
   * resto del contexto se actualice; al cambiar, la conversación se descarta.
   */
  key: string;
  /** Primer mensaje que ve el estudiante al abrir. Se arma en el cliente, sin llamar al modelo. */
  saludo: string;
  tema: string;
  subtema: string;
  nombreBloque?: string;
  /** Markdown del bloque que el estudiante está viendo. */
  contenidoBloque?: string;
}

export interface ChatMessage {
  id: string;
  rol: 'estudiante' | 'tutor';
  texto: string;
}
