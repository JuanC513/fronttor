import { Component, effect, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { TagModule } from 'primeng/tag';
import { CustomScrollPanel } from '@shared/components/custom-scroll-panel/custom-scroll-panel';
import { ButtonModule } from 'primeng/button';
import { ChatContext } from '@domain/ai/models/chat-model';
import { AiChatService } from '@domain/ai/services/ai-chat-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { Module } from '@domain/learning/models/module-model';
import { Lesson } from '@domain/learning/models/lesson-model';
import { LessonService } from '@domain/learning/services/lesson-service';
import { BlockService } from '@domain/learning/services/block-service';
import { Block } from '@domain/learning/models/block-model';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-learning-lesson',
  imports: [
    TabsModule,
    RouterLink,
    MarkdownRenderer,
    TagModule,
    CustomScrollPanel,
    ButtonModule,
    SkeletonModule,
    MessageModule,
  ],
  templateUrl: './learning-lesson.html',
  styleUrl: './learning-lesson.scss',
})
export class LearningLesson implements OnInit, OnDestroy {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly blockService = inject(BlockService);
  private readonly chatService = inject(AiChatService);
  currentModule = signal<Module | null>(null);
  currentLesson = signal<Lesson | null>(null);
  currentBlocks = signal<Block[] | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  /** Señal (y no un número plano) para que el chat pueda seguir el bloque en pantalla. */
  activeTab = signal(0);

  tabSkeletons = Array(8).fill(0);
  contentSkeletons = Array(3).fill(0);

  constructor() {
    effect(() => this.publishChatContext());
  }

  ngOnInit() {
    const moduleId = Number(this.activatedRoute.snapshot.paramMap.get('moduleId'));
    const lessonId = Number(this.activatedRoute.snapshot.paramMap.get('lessonId'));
    this.fetchData(moduleId, lessonId);
  }

  /** Al salir de la vista el chat deja de estar disponible y la conversación se descarta. */
  ngOnDestroy(): void {
    this.chatService.clearContext();
  }

  async fetchData(moduleId: number, lessonId: number) {
    try {
      const moduleData = await this.moduleService.getById(moduleId);
      const currentLesson = await this.lessonService.getById(lessonId);
      const currentBlocks = await this.blockService.getAllByLessonId(lessonId);
      this.currentModule.set(moduleData);
      this.currentLesson.set(currentLesson);
      this.currentBlocks.set(currentBlocks);
    } catch (err) {
      this.error.set('No se pudo cargar la información. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Publica el contexto para el tutor cada vez que cambia el subtema o el bloque visible.
   *
   * El `key` se ata a la lección: cambiar de pestaña refresca el bloque pero conserva la
   * conversación, mientras que cambiar de subtema la descarta.
   *
   * El saludo nombra el subtema pero no el bloque a propósito: el estudiante puede cambiar
   * de pestaña sin cerrar el chat, y un saludo que nombrara el bloque quedaría desactualizado
   * en pantalla sin poder reescribirse.
   */
  private publishChatContext(): void {
    const module = this.currentModule();
    const lesson = this.currentLesson();

    if (!module || !lesson) return;

    const block = this.currentBlocks()?.[this.activeTab()];

    const context: ChatContext = {
      key: `lesson:${lesson.id}`,
      saludo:
        `¡Hola! Soy tu tutor de IA. Veo que estás en **${lesson.name}**. ` +
        '¿Qué duda tienes sobre este subtema?',
      tema: module.name,
      subtema: lesson.name,
      nombreBloque: block?.name,
      contenidoBloque: block?.content,
    };

    // `setContext` lee el contexto anterior para comparar el `key` y luego escribe el nuevo.
    // Sin `untracked`, esa lectura convertiría al efecto en dependiente de la misma señal que
    // acaba de modificar, y como cada llamada crea un objeto nuevo, el ciclo no pararía nunca.
    untracked(() => this.chatService.setContext(context));
  }
}
