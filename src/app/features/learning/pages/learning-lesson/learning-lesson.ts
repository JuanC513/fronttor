import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'app-learning-lesson',
  imports: [TabsModule, ScrollPanelModule, RouterLink, MarkdownRenderer, TagModule],
  templateUrl: './learning-lesson.html',
  styleUrl: './learning-lesson.scss',
})
export class LearningLesson implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  moduleId!: number;
  lessonId!: number;

  modules = [
    {
      name: 'Tema #1 HTML: Estructura y Semántica',
      lessons: [
        'Etiquetas básicas (html, head, body, p, h1–h6, a, img)',
        'Elementos semánticos (header, nav, main, article, section)',
        'Listas, tablas y formularios',
        'Enlaces y atributos globales',
      ],
    },
    {
      name: 'Tema #2 CSS: Estilos y Diseño Visual',
      lessons: [
        'Selectores y propiedades básicas',
        'Colores, fuentes y texto',
        'Modelo de caja (box model)',
        'Bordes, márgenes, rellenos y fondos',
        'Posicionamiento y visualización de elementos',
      ],
    },
    {
      name: 'Tema #3 Diseño responsivo y Buenas Prácticas',
      lessons: [
        'Uso de unidades relativas',
        'Media queries',
        'Flexbox y Grid Layout',
        'Accesibilidad y semántica visual',
        'Organización y reutilización de estilos',
      ],
    },
    {
      name: 'Tema #4 Interactividad y Fundamentos de Frameworks',
      lessons: [
        'Manipulación del DOM',
        'Introducción a la interactividad con JavaScript',
        'Principios de componentes y reactividad',
        'Ejemplos introductorios con frameworks frontend',
      ],
    },
    {
      name: 'Tema #5 Integración y Prácticas Guiadas',
      lessons: [
        'Estructura de una página completa',
        'Aplicación combinada de estilos y scripts',
        'Retroalimentación automática del código ',
        'Corrección guiada y explicación adaptativa de errores',
      ],
    },
  ];

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

  activeTab = 0;

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
    this.moduleId = Number(this.activatedRoute.snapshot.paramMap.get('moduleId'));
    this.lessonId = Number(this.activatedRoute.snapshot.paramMap.get('lessonId'));
  }
}
