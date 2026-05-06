import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Module } from '@domain/learning/models/module-model';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { SkeletonModule } from 'primeng/skeleton';
import { SplitterModule } from 'primeng/splitter';

@Component({
  selector: 'app-admin-main',
  imports: [SkeletonModule, ScrollPanelModule, ButtonModule, SplitterModule],
  templateUrl: './admin-main.html',
  styleUrl: './admin-main.scss',
})
export class AdminMain implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);

  modules = signal<Module[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  skeletons = Array(4).fill(0);

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

  createModule() {
    this.router.navigate(['admin/module/new']);
  }

  editModule(id: number) {
    this.router.navigate([`admin/module/edit/${id}`]);
  }
}
