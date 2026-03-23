import { Component } from '@angular/core';

@Component({
  selector: 'app-learning-page',
  imports: [],
  templateUrl: './learning-page.html',
  styleUrl: './learning-page.scss',
})
export class LearningPage {
  textoPrueba = `
  - INTRODUCCIÓN

  Etiquetas básicas de HTML

HTML (HyperText Markup Language) es el lenguaje que se utiliza para crear la estructura de las páginas web. Funciona mediante etiquetas, que indican al navegador cómo debe organizar y mostrar el contenido.

- CONCEPTOS

<html>

La etiqueta <html> es la etiqueta principal de un documento HTML. Todo el contenido de la página debe estar dentro de esta etiqueta. Le indica al navegador que el documento está escrito en HTML.

<head>

La etiqueta <head> contiene información sobre la página, pero que normalmente no se muestra directamente en el contenido visible del sitio. Aquí se colocan elementos como el título de la página, enlaces a hojas de estilo (CSS), scripts o configuraciones del documento.

<body>

La etiqueta <body> contiene todo el contenido visible de la página web, como textos, imágenes, enlaces, botones y otros elementos que el usuario puede ver e interactuar.

<p>

La etiqueta <p> se utiliza para crear párrafos de texto. Es una de las etiquetas más comunes para mostrar contenido escrito dentro de una página web.

- EJEMPLOS

Ejemplo:

<p>Este es un párrafo en una página web.</p>
<h1> a <h6>

Estas etiquetas se utilizan para crear títulos o encabezados. Existen seis niveles de encabezado:

<h1> es el título más importante o más grande.

<h6> es el menos importante o más pequeño.

Ejemplo:

<h1>Título principal</h1>
<h2>Subtítulo</h2>
<a>

La etiqueta <a> se usa para crear enlaces o hipervínculos, que permiten navegar a otras páginas web o a otras secciones dentro de la misma página.

Ejemplo:

<a href="https://www.ejemplo.com">Visitar página</a>
<img>

La etiqueta <img> se utiliza para mostrar imágenes en una página web. Para funcionar necesita al menos el atributo src, que indica la ruta de la imagen.

Ejemplo:

<img src="imagen.jpg" alt="Descripción de la imagen">

El atributo alt sirve para describir la imagen, lo cual es importante para accesibilidad y cuando la imagen no puede cargarse.

| Introducción | Conceptos | Ejemplos | Ejercicios | Resumen |

- Introducción 
- Conceptos
- Ejemplos
- Ejercicios
- Resumen

- EJERCICIOS
`;
}
