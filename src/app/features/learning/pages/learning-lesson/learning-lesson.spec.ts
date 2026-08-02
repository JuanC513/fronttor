import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Block } from '@domain/learning/models/block-model';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';

import { LearningLesson } from './learning-lesson';

describe('LearningLesson', () => {
  const buildBlock = (id: number): Block => ({
    id,
    name: `Bloque ${id}`,
    content: `# Contenido ${id}`,
    order: id,
    lesson_id: 1,
  });

  /** Monta el componente con los tres servicios espiados y la ruta `/modules/1/lessons/1`. */
  const setup = async (blocks: Block[], failing = false) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getById']);
    const lessonService = jasmine.createSpyObj<LessonService>('LessonService', ['getById']);
    const blockService = jasmine.createSpyObj<BlockService>('BlockService', ['getAllByLessonId']);

    moduleService.getById.and.resolveTo({ id: 1, name: 'Tema 1', order: 1 });
    lessonService.getById.and.resolveTo({ id: 1, name: 'Subtema 1', order: 1, module_id: 1 });

    if (failing) {
      blockService.getAllByLessonId.and.rejectWith(new Error('boom'));
    } else {
      blockService.getAllByLessonId.and.resolveTo(blocks);
    }

    TestBed.configureTestingModule({
      imports: [LearningLesson],
      providers: [
        provideRouter([]),
        // `MarkdownRenderer` depende de ngx-markdown, que en la app se registra en `app.config.ts`.
        importProvidersFrom(MarkdownModule.forRoot()),
        { provide: ModuleService, useValue: moduleService },
        { provide: LessonService, useValue: lessonService },
        { provide: BlockService, useValue: blockService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ moduleId: '1', lessonId: '1' }) } },
        },
      ],
    });

    const fixture: ComponentFixture<LearningLesson> = TestBed.createComponent(LearningLesson);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    expect((await setup([buildBlock(1)])).componentInstance).toBeTruthy();
  });

  it('pinta una pestaña por bloque', async () => {
    const fixture = await setup([buildBlock(1), buildBlock(2)]);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('p-tab').length).toBe(2);
    expect(element.querySelector('.content-empty')).toBeNull();
  });

  it('muestra el estado vacío cuando el subtema no tiene bloques', async () => {
    // Se llega aquí por URL directa: el recorrido ya no lista los subtemas sin contenido.
    const fixture = await setup([]);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.content-empty')).not.toBeNull();
    expect(element.querySelectorAll('p-tab').length).toBe(0);
    // El pie con "Regresar" se mantiene para que siempre haya salida.
    expect(element.querySelector('.footer')).not.toBeNull();
  });

  it('muestra el error cuando falla la carga', async () => {
    const fixture = await setup([], true);

    expect(fixture.componentInstance.error()).toContain('No se pudo cargar');
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.header')).toBeNull();
  });
});
