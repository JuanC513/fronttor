import { Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';

interface MarkdownCheatsheetEntry {
  label: string;
  syntax: string;
}

const COPIED_FEEDBACK_MS = 1500;

@Component({
  selector: 'app-markdown-cheatsheet',
  imports: [ButtonModule, PopoverModule, MarkdownRenderer],
  templateUrl: './markdown-cheatsheet.html',
  styleUrl: './markdown-cheatsheet.scss',
})
export class MarkdownCheatsheet {
  readonly entries: MarkdownCheatsheetEntry[] = [
    { label: 'Título grande', syntax: '# Título grande' },
    { label: 'Título mediano', syntax: '## Título mediano' },
    { label: 'Título pequeño', syntax: '### Título pequeño' },
    { label: 'Negrita', syntax: 'Texto en **negrita**' },
    { label: 'Cursiva', syntax: 'Texto en *cursiva*' },
    { label: 'Código en línea', syntax: 'Usa el método `parseInt()`' },
    {
      label: 'Bloque de código',
      syntax: '```html\n<p>Hola, mundo</p>\n```',
    },
    { label: 'Lista con viñetas', syntax: '- Elemento uno\n- Elemento dos' },
    { label: 'Lista numerada', syntax: '1. Elemento uno\n2. Elemento dos' },
    { label: 'Cita', syntax: '> Una nota o cita importante' },
    { label: 'Enlace', syntax: '[Documentación MDN](https://developer.mozilla.org)' },
    { label: 'Imagen', syntax: '![Texto alternativo](https://ejemplo.com/imagen.png)' },
    {
      label: 'Tabla',
      syntax: '| Etiqueta | Atributo |\n| --- | --- |\n| `<img>` | `src` |',
    },
    { label: 'Línea horizontal', syntax: '---' },
  ];

  private readonly copiedLabelSignal = signal<string | null>(null);
  readonly copiedLabel = this.copiedLabelSignal.asReadonly();

  async copySyntax(entry: MarkdownCheatsheetEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.syntax);
      this.copiedLabelSignal.set(entry.label);
      setTimeout(() => {
        if (this.copiedLabelSignal() === entry.label) {
          this.copiedLabelSignal.set(null);
        }
      }, COPIED_FEEDBACK_MS);
    } catch (err) {
      console.error('No se pudo copiar al portapapeles. Intenta de nuevo. ' + err);
    }
  }
}
