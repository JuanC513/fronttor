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
}
