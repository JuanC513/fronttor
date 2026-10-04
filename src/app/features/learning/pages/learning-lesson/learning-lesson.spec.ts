import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Block } from '@domain/learning/models/block-model';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ProgressService } from '@domain/learning/services/progress-service';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { LearningLesson } from './learning-lesson';

describe('LearningLesson', () => {
  const buildBlock = (id: number): Block => ({
    id,
    name: `Bloque ${id}`,
    content: `# Contenido ${id}`,
    order: id,
    lesson_id: 1,
    is_published: true,
  });

  /** Monta el componente con los tres servicios espiados y la ruta `/modules/1/lessons/1`. */
  const setup = async (blocks: Block[], failing = false, visitaRechazada = false) => {
    const moduleService = jasmine.createSpyObj<ModuleService>('ModuleService', ['getById']);
    const lessonService = jasmine.createSpyObj<LessonService>('LessonService', ['getById']);
    const blockService = jasmine.createSpyObj<BlockService>('BlockService', [
      'getPublishedByLessonId',
    ]);

    // Sin doblarlo, la vista llama al servicio real: cliente de Supabase, red y prueba colgada
    // hasta el tiempo limite de Jasmine. Marcar la visita es un efecto del montaje, no algo que
    // estas pruebas provoquen a proposito.
    const progressService = jasmine.createSpyObj<ProgressService>('ProgressService', [
      'markLessonViewed',
    ]);
    // `visitaRechazada` tiene que quedar puesto antes del montaje: la visita se marca como efecto
    // de `ngOnInit`, asi que cambiar el espia despues no llega a tiempo de nada.
    if (visitaRechazada) {
      progressService.markLessonViewed.and.rejectWith(
        new Error('Este subtema todavia no esta disponible'),
      );
    } else {
      progressService.markLessonViewed.and.resolveTo();
    }

    moduleService.getById.and.resolveTo({ id: 1, name: 'Tema 1', order: 1, is_published: true });
    lessonService.getById.and.resolveTo({
      id: 1,
      name: 'Subtema 1',
      order: 1,
      module_id: 1,
      is_published: true,
    });

    if (failing) {
      blockService.getPublishedByLessonId.and.rejectWith(new Error('boom'));
    } else {
      blockService.getPublishedByLessonId.and.resolveTo(blocks);
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
        { provide: ProgressService, useValue: progressService },
        // La vista inyecta AiChatService, que arrastra al cliente real de Supabase. Ese cliente
        // arranca su maquinaria de sesion —locks del navegador incluidos— y deja promesas vivas,
        // asi que la zona nunca se estabiliza y `whenStable()` agota el tiempo de Jasmine. Nada de
        // lo que se prueba aqui llega a usarlo.
        { provide: SupabaseService, useValue: { client: {} } },
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

  /**
   * Desde `20260929120000` la RPC se niega a registrar la visita a un subtema al que el estudiante
   * no ha llegado. Solo se llega ahí por URL directa —el guard de la ruta lo ataja antes—, y la
   * página no debe romperse ni perder lo que ya cargó: anotar el progreso es accesorio.
   */
  it('sobrevive a que la base rechace registrar la visita', async () => {
    const fixture = await setup([buildBlock(1)], false, true);

    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('p-tab').length).toBe(1);
  });

  it('muestra el error cuando falla la carga', async () => {
    const fixture = await setup([], true);

    expect(fixture.componentInstance.error()).toContain('No se pudo cargar');
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.header')).toBeNull();
  });
});
