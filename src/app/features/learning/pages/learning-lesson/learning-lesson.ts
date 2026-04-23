import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { TagModule } from 'primeng/tag';
import { CustomScrollPanel } from '@shared/components/custom-scroll-panel/custom-scroll-panel';
import { ButtonModule } from 'primeng/button';
import { ModuleService } from '@domain/learning/services/module-service';
import { Module } from '@domain/learning/models/module-model';
import { Lesson } from '@domain/learning/models/lesson-model';
import { LessonService } from '@domain/learning/services/lesson-service';
import { BlockService } from '@domain/learning/services/block-service';
import { Block } from '@domain/learning/models/block-model';

@Component({
  selector: 'app-learning-lesson',
  imports: [TabsModule, RouterLink, MarkdownRenderer, TagModule, CustomScrollPanel, ButtonModule],
  templateUrl: './learning-lesson.html',
  styleUrl: './learning-lesson.scss',
})
export class LearningLesson implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly blockService = inject(BlockService);
  currentModule = signal<Module | null>(null);
  currentLesson = signal<Lesson | null>(null);
  currentBlocks = signal<Block[] | null>(null);
  activeTab = 0;

  ngOnInit() {
    const moduleId = Number(this.activatedRoute.snapshot.paramMap.get('moduleId'));
    const lessonId = Number(this.activatedRoute.snapshot.paramMap.get('lessonId'));
    this.fetchData(moduleId, lessonId);
  }
  async fetchData(moduleId: number, lessonId: number) {
    try {
      const moduleData = await this.moduleService.getById(moduleId);
      const currentLesson = await this.lessonService.getById(lessonId);
      const currentBlocks = await this.blockService.getAllByLessonId(lessonId);
      this.currentModule.set(moduleData);
      this.currentLesson.set(currentLesson);
      this.currentBlocks.set(currentBlocks);
      // } catch (err) {
    } catch {
      // this.error.set('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    } finally {
      // this.loading.set(false);
    }
  }
}
