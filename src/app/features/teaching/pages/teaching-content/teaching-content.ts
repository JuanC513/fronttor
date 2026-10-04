import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SplitterModule } from 'primeng/splitter';
import { OrderListModule } from 'primeng/orderlist';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ListboxModule } from 'primeng/listbox';
import { MessageModule } from 'primeng/message';
import { FormsModule } from '@angular/forms';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { LessonService } from '@domain/learning/services/lesson-service';
import { Block } from '@domain/learning/models/block-model';
import { BlockService } from '@domain/learning/services/block-service';
import {
  PublicationStatus,
  resolveBlockStatus,
  resolveLessonStatus,
  resolveModuleStatus,
} from '@domain/learning/utils/publication-state';
import { TeachingTabs } from '@features/teaching/components/teaching-tabs/teaching-tabs';
import { PublicationBadge } from '@shared/components/publication-badge/publication-badge';

@Component({
  selector: 'app-teaching-content',
  imports: [
    SkeletonModule,
    ButtonModule,
    SplitterModule,
    RouterOutlet,
    OrderListModule,
    ListboxModule,
    MessageModule,
    FormsModule,
    PublicationBadge,
    TeachingTabs,
  ],
  templateUrl: './teaching-content.html',
  styleUrl: './teaching-content.scss',
})
export class TeachingContent {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly blockService = inject(BlockService);
  private readonly notifications = inject(NotificationService);

  isModuleReordering = signal(false);
  isModuleSaving = signal(false);
  modules = signal<ModuleWithLessons[]>([]);
  modulesBuffer: ModuleWithLessons[] = [];
  loading = signal(true);
  /** Solo fallos de CARGA: dejan la pantalla vacía, así que el aviso tiene que permanecer. El
   * resultado de guardar o reordenar va por toast. */
  error = signal<string | null>(null);
  skeletons = Array(4).fill(0);
  selectedModule = signal<ModuleWithLessons | undefined>(undefined);
  selectedLesson = signal<Lesson | undefined>(undefined);
  blocksList = signal<Block[]>([]);

  /** El id del tema elegido en la pasada anterior. Ver el segundo efecto del constructor. */
  private lastModuleId: number | undefined;

  constructor() {
    // Toda escritura —crear, editar, borrar o reordenar, en cualquiera de los tres niveles—
    // incrementa su `refreshTrigger`. Leerlos los tres aquí es lo que recarga la vista sola.
    // El efecto corre también en el arranque, así que no hace falta `ngOnInit`.
    effect(() => {
      this.moduleService.refreshTrigger();
      this.lessonService.refreshTrigger();
      this.blockService.refreshTrigger();
      void this.reload();
    });

    // Cambiar de tema vacía el subtema elegido, pero SOLO si de verdad es otro tema.
    //
    // Se compara por id y no por referencia a propósito: `resyncSelection` reasigna el mismo tema
    // como objeto nuevo en cada recarga, y comparando referencias esto lo borraría todo otra vez.
    effect(() => {
      const moduleId = this.selectedModule()?.id;
      if (moduleId === this.lastModuleId) return;

      this.lastModuleId = moduleId;
      this.selectedLesson.set(undefined);
    });
  }

  private async reload(): Promise<void> {
    await Promise.all([this.fetchModules(), this.fetchBlocks()]);
    this.resyncSelection();
  }

  /**
   * Devuelve la selección a los objetos recién cargados, o la vacía si ya no existen.
   *
   * Hace falta porque `fetchModules` sustituye el array entero por objetos nuevos y el elegido se
   * quedaría obsoleto. La plantilla lee de él dos cosas que importan: `lessons.length`, que decide
   * si se pinta la lista de subtemas, y `order`, que numera las etiquetas.
   *
   * Las LISTAS no necesitan esto —`currentLessons` y `currentBlocks` ya se derivan por id de lo
   * recién traído, y los `p-listbox` llevan `dataKey="id"`—, así que basta con refrescar el objeto.
   *
   * Antes el problema se evitaba vaciando la selección en cada recarga, lo que obligaba a elegir
   * tema y subtema otra vez después de cambiar una sola palabra de un bloque.
   */
  private resyncSelection(): void {
    const moduleId = this.selectedModule()?.id;
    const lessonId = this.selectedLesson()?.id;

    // `find` devuelve `undefined` si lo elegido se borró, que es justo lo que se quiere.
    const module = this.modules().find((item) => item.id === moduleId);

    this.selectedModule.set(module);
    this.selectedLesson.set((module?.lessons ?? []).find((item) => item.id === lessonId));
  }

  get isReorderingOrSaving(): boolean {
    return (
      this.isModuleReordering() ||
      this.isModuleSaving() ||
      this.isLessonReordering() ||
      this.isLessonSaving() ||
      this.isBlockReordering() ||
      this.isBlockSaving()
    );
  }

  get currentLessons() {
    if (!this.selectedModule) {
      return [];
    }

    return this.modules().find((module) => module.id === this.selectedModule()!.id)?.lessons ?? [];
  }

  get currentBlocks() {
    if (!this.selectedLesson()) {
      return [];
    }

    return this.blocksList().filter((block) => block.lesson_id === this.selectedLesson()!.id);
  }

  // Estado de publicación de cada fila del listado. Se deriva de lo que ya está cargado
  // (`modules()` trae los subtemas anidados y `blocksList()` todos los bloques), así que no cuesta
  // ninguna consulta extra.

  moduleStatus(module: ModuleWithLessons): PublicationStatus {
    return resolveModuleStatus({
      module,
      lessons: module.lessons ?? [],
      blocks: this.blocksList(),
    });
  }

  lessonStatus(lesson: Lesson): PublicationStatus {
    const module = this.selectedModule();
    if (!module) return { state: 'draft' };

    return resolveLessonStatus({
      lesson,
      module,
      siblingLessons: module.lessons ?? [],
      blocks: this.blocksList(),
    });
  }

  blockStatus(block: Block): PublicationStatus {
    const module = this.selectedModule();
    const lesson = this.selectedLesson();
    if (!module || !lesson) return { state: 'draft' };

    return resolveBlockStatus({ block, lesson, module, siblingBlocks: this.currentBlocks });
  }

  async fetchModules() {
    try {
      const data = await this.moduleService.getAllWithLessons();
      this.modules.set(data);
    } catch (err) {
      this.error.set('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchBlocks() {
    try {
      const data = await this.blockService.getAll();
      this.blocksList.set(data);
    } catch (err) {
      this.error.set('No se pudieron cargar los bloques. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  startModulesReorder() {
    this.modulesBuffer = [...this.modules()];
    this.isModuleReordering.set(true);
  }

  cancelModulesReorder() {
    this.isModuleReordering.set(false);
  }

  async saveModulesOrder() {
    this.isModuleSaving.set(true);
    try {
      const ids = this.modulesBuffer.map((m) => m.id);
      await this.moduleService.reorderAll(ids);
      this.modules.set(this.modulesBuffer.map((m, i) => ({ ...m, order: i + 1 })));
      this.isModuleReordering.set(false);
      this.isModuleSaving.set(false);
      this.notifications.exito('Orden de los temas guardado');
    } catch (err) {
      this.isModuleSaving.set(false);
      this.notifications.error(
        'No se pudo guardar el orden',
        err instanceof Error ? err.message : String(err),
      );
      await this.fetchModules();
    }
  }

  createModule() {
    this.router.navigate(['teaching/module/new']);
  }

  editModule(id: number) {
    this.router.navigate([`teaching/module/edit/${id}`]);
  }

  // Lesson
  isLessonReordering = signal(false);
  isLessonSaving = signal(false);
  lessonsBuffer: Lesson[] = [];

  createLesson() {
    const moduleId = this.selectedModule()?.id;

    this.router.navigate(['teaching/lesson/new'], {
      queryParams: moduleId ? { moduleId } : {},
    });
  }

  editLesson(id: number) {
    this.router.navigate([`teaching/lesson/edit/${id}`]);
  }

  startLessonsReorder() {
    this.lessonsBuffer = [...this.currentLessons];
    this.isLessonReordering.set(true);
  }

  cancelLessonsReorder() {
    this.isLessonReordering.set(false);
  }

  async saveLessonsOrder() {
    this.isLessonSaving.set(true);
    try {
      const ids = this.lessonsBuffer.map((l) => l.id);
      await this.lessonService.reorderAll(ids);
      this.isLessonReordering.set(false);
      this.isLessonSaving.set(false);
      this.notifications.exito('Orden de los subtemas guardado');
    } catch (err) {
      this.isLessonSaving.set(false);
      this.notifications.error(
        'No se pudo guardar el orden',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Block
  isBlockReordering = signal(false);
  isBlockSaving = signal(false);
  blocksBuffer: Block[] = [];

  /** Lleva al listado de ejercicios ya filtrado por el subtema seleccionado. */
  viewExercises() {
    const lessonId = this.selectedLesson()?.id;
    if (!lessonId) return;

    this.router.navigate(['teaching/exercises'], { queryParams: { lessonId } });
  }

  createBlock() {
    const moduleId = this.selectedModule()?.id;
    const lessonId = this.selectedLesson()?.id;

    this.router.navigate(['teaching/block/new'], {
      queryParams: moduleId && lessonId ? { moduleId, lessonId } : {},
    });
  }

  editBlock(id: number) {
    this.router.navigate([`teaching/block/edit/${id}`]);
  }

  startBlocksReorder() {
    this.blocksBuffer = [...this.currentBlocks];
    this.isBlockReordering.set(true);
  }

  cancelBlocksReorder() {
    this.isBlockReordering.set(false);
  }

  async saveBlocksOrder() {
    this.isBlockSaving.set(true);
    try {
      const ids = this.blocksBuffer.map((l) => l.id);
      await this.blockService.reorderAll(ids);
      this.isBlockReordering.set(false);
      this.isBlockSaving.set(false);
      this.notifications.exito('Orden de los bloques guardado');
    } catch (err) {
      this.isBlockSaving.set(false);
      this.notifications.error(
        'No se pudo guardar el orden',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
