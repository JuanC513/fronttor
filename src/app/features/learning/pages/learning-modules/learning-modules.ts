import { Component } from '@angular/core';

interface module {
  name: string;
  subModules: string[];
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
      subModules: [
        'Etiquetas básicas (html, head, body, p, h1–h6, a, img)',
        'Elementos semánticos (header, nav, main, article, section)',
        'Listas, tablas y formularios',
        'Enlaces y atributos globales',
      ],
    },
    {
      name: 'Tema #2 CSS: Estilos y Diseño Visual',
      subModules: [],
    },
    {
      name: 'Tema #3 Diseño responsivo y Buenas Prácticas',
      subModules: [],
    },
    {
      name: 'Tema #4 Interactividad y Fundamentos de Frameworks',
      subModules: [],
    },
    {
      name: 'Tema #5 Integración y Prácticas Guiadas',
      subModules: [],
    },
  ];
}
