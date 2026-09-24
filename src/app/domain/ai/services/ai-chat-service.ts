import { inject, Injectable, signal } from '@angular/core';
import { AnswerQuestionRequest, ChatTurn } from '../models/answer-question-model';
import { ChatContext, ChatMessage } from '../models/chat-model';
import { AiService } from './ai-service';

/** Mensajes que se conservan en pantalla. Evita un chat infinito en memoria. */
const MAX_MENSAJES_VISIBLES = 20;
/** Turnos que se mandan como contexto. El servidor vuelve a recortar por su cuenta. */
const MAX_TURNOS_ENVIADOS = 6;
/**
 * Debe coincidir con MAX_PREGUNTA_LENGTH en
 * supabase/functions/_shared/prompts/question-prompt.ts.
 *
 * No se importa desde ahí: Angular (Vite/esbuild) no compila archivos fuera de `rootDir`
 * (src/) — se intentó y el build falla. La sincronización la garantiza
 * `scripts/check-prompt-limits-sync.mjs`, que `npm run check` corre en cada commit y hace
 * fallar el build si los dos números alguna vez se desincronizan.
 */
export const MAX_PREGUNTA_LENGTH = 1_500;

/**
 * Estado de la conversación con el tutor IA.
 *
 * Vive en la raíz y no provisto por componente (a diferencia de `CodeRunnerStateService`)
 * porque el panel se monta en `AppLayout` y la vista que aporta el contexto es descendiente
 * suya: no comparten inyector. Por eso la limpieza es explícita — `clearContext()` — y no
 * depende de que Angular destruya un componente.
 *
 * Para usarlo en otra vista basta llamar `setContext()` al entrar y `clearContext()` al salir.
 */
@Injectable({
  providedIn: 'root',
})
export class AiChatService {
  private readonly aiService = inject(AiService);

  private readonly _context = signal<ChatContext | null>(null);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _isOpen = signal(false);
  private readonly _isSending = signal(false);
  private readonly _error = signal<string | null>(null);

  /** Mientras sea `null`, el chat no está disponible y su disparador no se muestra. */
  readonly context = this._context.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly isSending = this._isSending.asReadonly();
  readonly error = this._error.asReadonly();

  private pendingController: AbortController | null = null;

  /**
   * Publica o actualiza el contexto. La vista puede llamarlo tantas veces como quiera.
   *
   * Es el `key` el que decide qué pasa con la conversación: si es el mismo, solo se refresca
   * el contexto y el historial sigue intacto (cambiar de bloque dentro del mismo subtema);
   * si cambia, la conversación anterior se descarta (cambiar de subtema).
   */
  setContext(context: ChatContext): void {
    const previous = this._context();
    this._context.set(context);

    if (previous?.key !== context.key) {
      this.resetConversation();
    }
  }

  /** Deja el chat indisponible y sin rastros. La vista lo llama al destruirse. */
  clearContext(): void {
    this._context.set(null);
    this._isOpen.set(false);
    this.resetConversation();
  }

  open(): void {
    const context = this._context();
    if (!context) return;

    // El saludo es texto local: gastar una petición al modelo en "Hola, soy tu tutor"
    // desperdiciaría cuota y añadiría segundos de espera cada vez que se abre el panel.
    if (this._messages().length === 0) {
      this._messages.set([this.buildMessage('tutor', context.saludo)]);
    }

    this._isOpen.set(true);
  }

  /** Cerrar cancela la respuesta en curso: el estudiante ya no la está esperando. */
  close(): void {
    this.abort();
    this._isOpen.set(false);
  }

  abort(): void {
    this.pendingController?.abort();
    this.pendingController = null;
    this._isSending.set(false);
  }

  async send(pregunta: string): Promise<void> {
    const context = this._context();
    const texto = pregunta.trim();

    if (!context || !texto || this._isSending()) return;

    this.pushMessage(this.buildMessage('estudiante', texto));

    // El historial se toma antes de agregar la pregunta nueva: esa viaja aparte, en su
    // propio campo, y duplicarla confundiría al modelo sobre cuál debe responder.
    const historial = this.buildHistorial();

    const controller = new AbortController();
    this.pendingController = controller;
    this._isSending.set(true);
    this._error.set(null);

    try {
      const respuesta = await this.aiService.answerQuestion(
        this.buildRequest(context, texto, historial),
        controller.signal,
      );

      this.pushMessage(this.buildMessage('tutor', respuesta));
    } catch (err) {
      // Abortar es una decisión del usuario, no un fallo que haya que mostrarle.
      if (controller.signal.aborted) return;
      this._error.set(err instanceof Error ? err.message : String(err));
    } finally {
      // Solo la petición vigente puede limpiar el estado: si otra la reemplazó, la que
      // termina tarde no debe apagar el indicador de la nueva.
      if (this.pendingController === controller) {
        this.pendingController = null;
        this._isSending.set(false);
      }
    }
  }

  /**
   * Traduce el contexto de la vista a la petición que espera la función.
   *
   * En modo código, `obtenerCodigo()` y `obtenerConsola()` se llaman **aquí**, al enviar, y no
   * cuando la vista publicó el contexto: lo que viaja es lo que el estudiante tiene escrito en el
   * momento de preguntar.
   */
  private buildRequest(
    context: ChatContext,
    pregunta: string,
    historial: ChatTurn[],
  ): AnswerQuestionRequest {
    if (context.tipo === 'codigo') {
      return {
        modo: 'codigo',
        pregunta,
        historial,
        codigo: context.obtenerCodigo(),
        consola: context.obtenerConsola(),
      };
    }

    return {
      modo: 'leccion',
      pregunta,
      historial,
      contenidoLeccion: context.contenidoBloque ?? '',
      tema: context.tema,
      subtema: context.subtema,
      nombreBloque: context.nombreBloque,
    };
  }

  private buildHistorial(): ChatTurn[] {
    return this._messages()
      .slice(0, -1) // sin la pregunta recién agregada
      .slice(-MAX_TURNOS_ENVIADOS)
      .map(({ rol, texto }) => ({ rol, texto }));
  }

  private buildMessage(rol: ChatMessage['rol'], texto: string): ChatMessage {
    return { id: crypto.randomUUID(), rol, texto };
  }

  /** Agrega un mensaje descartando los más antiguos si se pasa del tope visible. */
  private pushMessage(message: ChatMessage): void {
    this._messages.update((messages) => [...messages, message].slice(-MAX_MENSAJES_VISIBLES));
  }

  private resetConversation(): void {
    this.abort();
    this._messages.set([]);
    this._error.set(null);
  }
}
