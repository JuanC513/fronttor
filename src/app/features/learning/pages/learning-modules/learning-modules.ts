import { Component } from '@angular/core';

interface module {
  name: string;
  lessons: string[];
}

@Component({
  selector: 'app-learning-modules',
  imports: [],
  templateUrl: './learning-modules.html',
  styleUrl: './learning-modules.scss',
})
export class LearningModules {
  contentModules: module[] = [
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
      lessons: [],
    },
    {
      name: 'Tema #3 Diseño responsivo y Buenas Prácticas',
      lessons: [],
    },
    {
      name: 'Tema #4 Interactividad y Fundamentos de Frameworks',
      lessons: [],
    },
    {
      name: 'Tema #5 Integración y Prácticas Guiadas',
      lessons: [],
    },
  ];
}
