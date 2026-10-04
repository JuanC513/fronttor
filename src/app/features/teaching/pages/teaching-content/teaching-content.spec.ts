import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { Block } from '@domain/learning/models/block-model';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';

import { TeachingContent } from './teaching-content';

/**
 * Las escrituras de la vista pasan por los tres servicios de dominio y la recarga la dispara su
 * `refreshTrigger`, así que los dobles tienen que traer esa señal: es lo que se empuja para simular
 * un guardado.
 */
describe('TeachingContent', () => {
  let component: TeachingContent;
  let fixture: ComponentFixture<TeachingContent>;
  let getAllWithLessons: jasmine.Spy;
  let getAllBlocks: jasmine.Spy;
  let moduleTrigger: ReturnType<typeof signal<number>>;
  let blockTrigger: ReturnType<typeof signal<number>>;

  const subtema = (id: number, moduleId: number, name: string) =>
    ({ id, module_id: moduleId, name, order: id, is_published: true }) as never;

  /** Árbol nuevo en cada llamada: es justo lo que vuelve obsoleto al objeto seleccionado. */
  const arbol = (): ModuleWithLessons[] =>
    [
      {
        id: 1,
        name: 'HTML',
        order: 1,
        is_published: true,
        lessons: [subtema(10, 1, 'Etiquetas'), subtema(11, 1, 'Semántica')],
      },
      { id: 2, name: 'CSS', order: 2, is_published: true, lessons: [subtema(20, 2, 'Selectores')] },
    ] as never;

  const bloques = (): Block[] =>
    [
      { id: 100, name: 'Fundamentos', content: '#', lesson_id: 10, order: 1, is_published: true },
    ] as never;

  const setup = async () => {
    moduleTrigger = signal(0);
    blockTrigger = signal(0);
    getAllWithLessons = jasmine.createSpy('getAllWithLessons').and.callFake(async () => arbol());
    getAllBlocks = jasmine.createSpy('getAll').and.callFake(async () => bloques());

    await TestBed.configureTestingModule({
      imports: [TeachingContent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: {} } },
        { provide: ModuleService, useValue: { refreshTrigger: moduleTrigger, getAllWithLessons } },
        { provide: LessonService, useValue: { refreshTrigger: signal(0) } },
        { provide: BlockService, useValue: { refreshTrigger: blockTrigger, getAll: getAllBlocks } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeachingContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /**
   * Elige tema y subtema como lo haría quien usa la vista.
   *
   * El `detectChanges` entre medias no es adorno: los efectos se vacían en la detección de cambios,
   * y sin él el que limpia el subtema correría más tarde, ya mezclado con la recarga.
   */
  const elegir = async (moduleId: number, lessonId: number) => {
    component.selectedModule.set(component.modules().find((m) => m.id === moduleId));
    fixture.detectChanges();
    await fixture.whenStable();
    component.selectedLesson.set(component.currentLessons.find((l) => l.id === lessonId));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** Lo que ocurre al pulsar «Actualizar» en un bloque. */
  const guardarBloque = async () => {
    blockTrigger.update((v) => v + 1);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  /** `ngOnInit` hacía lo mismo que el efecto del constructor, así que todo se pedía dos veces. */
  it('carga los datos una sola vez al entrar', async () => {
    await setup();

    expect(getAllWithLessons).toHaveBeenCalledTimes(1);
    expect(getAllBlocks).toHaveBeenCalledTimes(1);
  });

  /**
   * La regresión que motivó todo esto: editar un bloque vaciaba la selección y había que volver a
   * filtrar por tema y subtema para encontrar lo que se estaba revisando.
   */
  it('conserva el tema y el subtema al guardar un bloque', async () => {
    await setup();
    await elegir(1, 11);

    await guardarBloque();

    expect(component.selectedModule()?.id).toBe(1);
    expect(component.selectedLesson()?.id).toBe(11);
  });

  /**
   * No basta con conservar el id: la plantilla lee `lessons.length` y `order` del objeto elegido,
   * así que tiene que quedar apuntando al recién traído y no al de antes.
   */
  it('reapunta la selección al objeto recién cargado', async () => {
    await setup();
    await elegir(1, 11);
    const anterior = component.selectedModule();

    await guardarBloque();

    expect(component.selectedModule()).not.toBe(anterior);
    expect(component.selectedModule()).toBe(component.modules().find((m) => m.id === 1));
  });

  it('vacía el subtema si dejó de existir, y conserva el tema', async () => {
    await setup();
    await elegir(1, 11);

    getAllWithLessons.and.callFake(async () => {
      const sinSemantica = arbol();
      sinSemantica[0].lessons = [subtema(10, 1, 'Etiquetas')];
      return sinSemantica;
    });
    await guardarBloque();

    expect(component.selectedModule()?.id).toBe(1);
    expect(component.selectedLesson()).toBeUndefined();
  });

  it('vacía ambos si el tema dejó de existir', async () => {
    await setup();
    await elegir(1, 11);

    getAllWithLessons.and.callFake(async () => arbol().filter((m) => m.id !== 1));
    await guardarBloque();

    expect(component.selectedModule()).toBeUndefined();
    expect(component.selectedLesson()).toBeUndefined();
  });

  /** Lo que el borrado por referencia sí hacía bien y no se puede perder al arreglarlo. */
  it('vacía el subtema cuando se cambia de tema a mano', async () => {
    await setup();
    await elegir(1, 11);

    component.selectedModule.set(component.modules().find((m) => m.id === 2));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedLesson()).toBeUndefined();
  });
});
