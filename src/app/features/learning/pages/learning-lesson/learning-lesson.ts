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
import { ProgressService } from '@domain/learning/services/progress-service';
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
  private readonly progressService = inject(ProgressService);
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

  /**
   * El listado de subtemas ya solo ofrece contenido publicado, pero a esta vista también se llega
   * escribiendo la URL. Sin esta comprobación, un subtema en preparación se mostraría entero a
   * quien acertara con el identificador.
   */
  async fetchData(moduleId: number, lessonId: number) {
    try {
      const moduleData = await this.moduleService.getById(moduleId);
      const currentLesson = await this.lessonService.getById(lessonId);
      const currentBlocks = await this.blockService.getPublishedByLessonId(lessonId);

      // Sin bloques publicados no se corta aquí: de eso se encarga el estado vacío de la
      // plantilla, que distingue "no tiene contenido todavía" de "está oculto a propósito".
      if (!moduleData.is_published || !currentLesson.is_published) {
        this.error.set('Este contenido todavía no está disponible.');
        return;
      }

      this.currentModule.set(moduleData);
      this.currentLesson.set(currentLesson);
      this.currentBlocks.set(currentBlocks);

      void this.markViewed(lessonId);
    } catch (err) {
      this.error.set('No se pudo cargar la información. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Deja constancia de que el estudiante abrió el subtema.
   *
   * Es lo que hace avanzar el recorrido: la RPC crea la fila de progreso, y de ella dependen el
   * desbloqueo del siguiente subtema y el completado automático de los que no tienen ejercicios.
   *
   * Se lanza sin esperarla y su fallo no interrumpe nada: el contenido ya está en pantalla, y
   * cortar la lectura por no haber podido anotar una marca de progreso sería peor que perderla.
   * Solo se anota después de comprobar la publicación, para no registrar visitas a lo que esta
   * misma vista considera no disponible.
   */
  private async markViewed(lessonId: number): Promise<void> {
    try {
      await this.progressService.markLessonViewed(lessonId);
    } catch (err) {
      console.error('No se pudo registrar la visita al subtema', err);
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
      tipo: 'leccion',
      saludo:
        `¡Hola! Soy tu tutor de IA. Veo que estás en **${lesson.name}**. ` +
        '¿Qué duda tienes sobre este subtema?',
      placeholder: 'Escribe tu duda sobre este subtema…',
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
