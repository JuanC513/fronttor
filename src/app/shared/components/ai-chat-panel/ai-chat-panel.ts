import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiChatService, MAX_PREGUNTA_LENGTH } from '@domain/ai/services/ai-chat-service';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

/**
 * Panel lateral del tutor IA. Se monta una sola vez en `AppLayout` y solo se renderiza
 * cuando alguna vista publicó contexto en `AiChatService`.
 *
 * Es deliberadamente un panel y no un modal: el caso de uso es "estoy leyendo esto y tengo
 * una duda", así que la lección tiene que seguir visible mientras se pregunta y se lee la
 * respuesta. En pantallas pequeñas sí ocupa todo el ancho, donde no hay espacio para ambos.
 */
@Component({
  selector: 'app-ai-chat-panel',
  imports: [
    DrawerModule,
    ButtonModule,
    TextareaModule,
    MessageModule,
    FormsModule,
    MarkdownRenderer,
  ],
  templateUrl: './ai-chat-panel.html',
  styleUrl: './ai-chat-panel.scss',
})
export class AiChatPanel {
  private readonly chatService = inject(AiChatService);

  readonly maxPreguntaLength = MAX_PREGUNTA_LENGTH;

  readonly context = this.chatService.context;
  readonly messages = this.chatService.messages;
  readonly isOpen = this.chatService.isOpen;
  readonly isSending = this.chatService.isSending;
  readonly error = this.chatService.error;

  readonly draft = signal('');

  private readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');

  constructor() {
    effect(() => {
      // Se lee para que el efecto vuelva a correr con cada mensaje nuevo y con el
      // indicador de "escribiendo", que también empuja el scroll hacia abajo.
      this.messages();
      this.isSending();
      this.scrollToBottom();
    });
  }

  get canSend(): boolean {
    return this.draft().trim().length > 0 && !this.isSending();
  }

  onSend(): void {
    if (!this.canSend) return;

    const pregunta = this.draft();
    this.draft.set('');
    void this.chatService.send(pregunta);
  }

  /** Enter envía; Shift+Enter deja escribir varias líneas, como en cualquier chat. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    this.onSend();
  }

  onHide(): void {
    this.chatService.close();
  }

  private scrollToBottom(): void {
    const element = this.messageList()?.nativeElement;
    if (!element) return;

    // El mensaje aún no está pintado cuando el efecto corre.
    queueMicrotask(() => {
      element.scrollTop = element.scrollHeight;
    });
  }
}
