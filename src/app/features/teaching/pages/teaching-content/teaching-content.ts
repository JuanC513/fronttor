import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { SplitterModule } from 'primeng/splitter';
import { OrderListModule } from 'primeng/orderlist';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ListboxModule } from 'primeng/listbox';
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
    FormsModule,
    PublicationBadge,
    TeachingTabs,
  ],
  templateUrl: './teaching-content.html',
  styleUrl: './teaching-content.scss',
})
export class TeachingContent implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly blockService = inject(BlockService);

  isModuleReordering = signal(false);
  isModuleSaving = signal(false);
  modules = signal<ModuleWithLessons[]>([]);
  modulesBuffer: ModuleWithLessons[] = [];
  loading = signal(true);
  error = signal<string | null>(null);
  skeletons = Array(4).fill(0);
  selectedModule = signal<ModuleWithLessons | undefined>(undefined);
  selectedLesson = signal<Lesson | undefined>(undefined);
  blocksList = signal<Block[]>([]);

  constructor() {
    effect(() => {
      // Cada vez que refreshTrigger cambie, recarga
      this.selectedModule.set(undefined);
      this.selectedLesson.set(undefined);
      this.moduleService.refreshTrigger();
      this.lessonService.refreshTrigger();
      this.blockService.refreshTrigger();
      this.fetchModules();
      this.fetchBlocks();
    });
    effect(() => {
      this.selectedModule();
      this.selectedLesson.set(undefined);
    });
  }

  ngOnInit() {
    this.fetchModules();
    this.fetchBlocks();
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
    } catch {
      this.isModuleSaving.set(false);
      this.error.set('No se pudo guardar el orden.');
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
    } catch {
      this.isLessonSaving.set(false);
      this.error.set('No se pudo guardar el orden.');
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
    } catch {
      this.isBlockSaving.set(false);
      this.error.set('No se pudo guardar el orden.');
    }
  }
}
