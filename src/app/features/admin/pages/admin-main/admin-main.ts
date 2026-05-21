import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Module } from '@domain/learning/models/module-model';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { SkeletonModule } from 'primeng/skeleton';
import { SplitterModule } from 'primeng/splitter';
import { OrderListModule } from 'primeng/orderlist';

@Component({
  selector: 'app-admin-main',
  imports: [
    SkeletonModule,
    ScrollPanelModule,
    ButtonModule,
    SplitterModule,
    RouterOutlet,
    OrderListModule,
  ],
  templateUrl: './admin-main.html',
  styleUrl: './admin-main.scss',
})
export class AdminMain implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);

  isReordering = signal(false);
  isSaving = signal(false);
  modules = signal<Module[]>([]);
  modulesBuffer: Module[] = [];
  loading = signal(true);
  error = signal<string | null>(null);
  skeletons = Array(4).fill(0);

  constructor() {
    effect(() => {
      // Cada vez que refreshTrigger cambie, recarga
      this.moduleService.refreshTrigger();
      this.fetchModules();
    });
  }

  ngOnInit() {
    this.fetchModules();
  }

  async fetchModules() {
    try {
      const data = await this.moduleService.getAll();
      this.modules.set(data);
    } catch (err) {
      this.error.set('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    } finally {
      this.loading.set(false);
    }
  }

  startReorder() {
    this.modulesBuffer = [...this.modules()];
    this.isReordering.set(true);
  }

  cancelReorder() {
    this.isReordering.set(false);
  }

  async saveOrder() {
    this.isSaving.set(true);
    try {
      const ids = this.modulesBuffer.map((m) => m.id);
      await this.moduleService.reorderAll(ids);
      this.modules.set(this.modulesBuffer.map((m, i) => ({ ...m, order: i + 1 })));
      this.isReordering.set(false);
      this.isSaving.set(false);
    } catch {
      this.isSaving.set(false);
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
}
