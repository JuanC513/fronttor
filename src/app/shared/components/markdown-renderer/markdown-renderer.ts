import { Component, Input, NO_ERRORS_SCHEMA } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-markdown-renderer',
  imports: [MarkdownModule],
  templateUrl: './markdown-renderer.html',
  styleUrl: './markdown-renderer.scss',
  schemas: [NO_ERRORS_SCHEMA],
})
export class MarkdownRenderer {
  @Input() content = '';
}
