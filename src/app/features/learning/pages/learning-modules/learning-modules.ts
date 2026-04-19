import { Component, inject, OnInit, signal } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { Router } from '@angular/router';
import { ModuleService } from '@domain/learning/services/module-service';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-learning-modules',
  imports: [AccordionModule, ScrollPanelModule, ButtonModule, SkeletonModule],
  templateUrl: './learning-modules.html',
  styleUrl: './learning-modules.scss',
})
export class LearningModules implements OnInit {
  private readonly router = inject(Router);
  private readonly moduleService = inject(ModuleService);

  modules = signal<ModuleWithLessons[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  skeletons = Array(4).fill(0);

  ngOnInit() {
    this.fetchModules();
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

  onSubmoduleClick(moduleId: number, lessonId: number) {
    this.router.navigate([`learning/modules/${moduleId}/lessons/${lessonId}`]);
  }
}
