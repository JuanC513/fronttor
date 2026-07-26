import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MarkdownModule } from 'ngx-markdown';

import { MarkdownCheatsheet } from './markdown-cheatsheet';

describe('MarkdownCheatsheet', () => {
  let component: MarkdownCheatsheet;
  let fixture: ComponentFixture<MarkdownCheatsheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownCheatsheet],
      providers: [importProvidersFrom(MarkdownModule.forRoot())],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownCheatsheet);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose reference entries for the core Markdown elements', () => {
    const labels = component.entries.map((entry) => entry.label);

    expect(labels).toContain('Título grande');
    expect(labels).toContain('Título mediano');
    expect(labels).toContain('Título pequeño');
    expect(labels).toContain('Negrita');
    expect(labels).toContain('Lista con viñetas');
    expect(labels).toContain('Bloque de código');
  });

  it('should render one help button and one popover in the DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('p-button').length).toBe(1);
    expect(compiled.querySelectorAll('p-popover').length).toBe(1);
  });

  describe('copySyntax', () => {
    beforeEach(() => {
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    });

    it('should copy the entry syntax to the clipboard and show feedback that resets after a timeout', fakeAsync(() => {
      const entry = component.entries[0];

      component.copySyntax(entry);
      tick();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(entry.syntax);
      expect(component.copiedLabel()).toBe(entry.label);

      tick(1500);

      expect(component.copiedLabel()).toBeNull();
    }));
  });
});
