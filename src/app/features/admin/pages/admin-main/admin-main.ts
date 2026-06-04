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

@Component({
  selector: 'app-admin-main',
  imports: [
    SkeletonModule,
    ButtonModule,
    SplitterModule,
    RouterOutlet,
    OrderListModule,
    ListboxModule,
    FormsModule,
  ],
  templateUrl: './admin-main.html',
  styleUrl: './admin-main.scss',
})
export class AdminMain implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);

  isModuleReordering = signal(false);
  isModuleSaving = signal(false);
  modules = signal<ModuleWithLessons[]>([]);
  modulesBuffer: ModuleWithLessons[] = [];
  loading = signal(true);
  error = signal<string | null>(null);
  skeletons = Array(4).fill(0);
  selectedModule: ModuleWithLessons | undefined = undefined;

  constructor() {
    effect(() => {
      // Cada vez que refreshTrigger cambie, recarga
      this.moduleService.refreshTrigger();
      this.lessonService.refreshTrigger();
      this.fetchModules();
    });
  }

  ngOnInit() {
    this.fetchModules();
  }

  get isReorderingOrSaving(): boolean {
    return (
      this.isModuleReordering() ||
      this.isModuleSaving() ||
      this.isLessonReordering() ||
      this.isLessonSaving()
    );
  }

  get currentLessons() {
    if (!this.selectedModule) {
      return [];
    }

    return this.modules().find((module) => module.id === this.selectedModule!.id)?.lessons ?? [];
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
    this.router.navigate(['admin/module/new']);
  }

  editModule(id: number) {
    this.router.navigate([`admin/module/edit/${id}`]);
  }

  // Lesson
  isLessonReordering = signal(false);
  isLessonSaving = signal(false);
  modulesWithlessons = signal<Lesson[]>([]);
  lessonsBuffer: Lesson[] = [];

  createLesson() {
    this.router.navigate(['admin/lesson/new']);
  }

  editLesson(id: number) {
    this.router.navigate([`admin/lesson/edit/${id}`]);
  }

  startLessonsReorder() {
    this.lessonsBuffer = [...this.currentLessons];
    this.isLessonReordering.set(true);
  }

  cancelLessonsReorder() {
    this.isLessonReordering.set(false);
  }

  async saveLessonsOrder() {
    // this.isLessonSaving.set(true);
    // try {
    //   const ids = this.modulesBuffer.map((m) => m.id);
    //   await this.moduleService.reorderAll(ids);
    //   this.modules.set(this.modulesBuffer.map((m, i) => ({ ...m, order: i + 1 })));
    //   this.isModuleReordering.set(false);
    //   this.isModuleSaving.set(false);
    // } catch {
    //   this.isModuleSaving.set(false);
    //   this.error.set('No se pudo guardar el orden.');
    //   await this.fetchModules();
    // }
  }
}
