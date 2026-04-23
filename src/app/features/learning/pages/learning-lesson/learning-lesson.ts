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
  currentModule = signal<Module | null>(null);
  currentLesson = signal<Lesson | null>(null);
  activeTab = 0;

  blocks = [
    {
      label: 'Fundamentos',
      content: '¿Qué es HTML y qué es una etiqueta?',
    },
    {
      label: 'Estructura',
      content: 'Estructura base de un documento HTML',
    },
    {
      label: 'Metadatos',
      content: 'La etiqueta <head>',
    },
    {
      label: 'Contenido',
      content: 'La etiqueta <body>',
    },
    {
      label: 'Jerarquía',
      content: 'Encabezados <h1> a <h6>',
    },
    {
      label: 'Texto',
      content: 'Párrafos <p>',
    },
    {
      label: 'Navegación',
      content: 'Enlaces <a>',
    },
    {
      label: 'Multimedia',
      content: 'Imágenes <img>',
    },
    {
      label: 'Configuración',
      content: 'Atributos en HTML',
    },
    {
      label: 'Calidad',
      content: `Buenas prácticas básicas
      
      
      ${'-\n\n\n\n\n\n\n\n\n\n'}
      Texto prueba
      
      
      ${'-\n\n\n\n\n\n\n\n\n\n'}
      Texto prueba

      
      ${'-\n\n\n\n\n\n\n\n\n\n'}
      Texto prueba

      
      ${'-\n\n\n\n\n\n\n\n\n\n'}
      Texto prueba
      `,
    },
  ];

  tempContent = `
    # Introducción a TypeScript

    TypeScript es un **superset tipado** de JavaScript.

    ## Variables y Tipos

    \`\`\`typescript
    const nombre: string = 'Juan';
    const edad: number = 25;
    let activo: boolean = true;
    \`\`\`

    ## Conceptos clave

    - **Tipado estático** — errores en tiempo de compilación
    - **Interfaces** — contratos para objetos
    - **Generics** — código reutilizable y seguro

    > 💡 Recuerda: TypeScript compila a JavaScript estándar.
    `;

  ngOnInit() {
    const moduleId = Number(this.activatedRoute.snapshot.paramMap.get('moduleId'));
    const lessonId = Number(this.activatedRoute.snapshot.paramMap.get('lessonId'));
    this.fetchData(moduleId, lessonId);
  }
  async fetchData(moduleId: number, lessonId: number) {
    try {
      const moduleData = await this.moduleService.getById(moduleId);
      const currentLesson = await this.lessonService.getById(lessonId);
      this.currentModule.set(moduleData);
      this.currentLesson.set(currentLesson);
      // } catch (err) {
    } catch {
      // this.error.set('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    } finally {
      // this.loading.set(false);
    }
  }
}
