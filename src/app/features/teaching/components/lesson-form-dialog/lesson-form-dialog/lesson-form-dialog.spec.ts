import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification-service';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { LessonService } from '@domain/learning/services/lesson-service';

import { LessonFormDialog } from './lesson-form-dialog';

describe('LessonFormDialog', () => {
  let component: LessonFormDialog;
  let fixture: ComponentFixture<LessonFormDialog>;
  let exito: jasmine.Spy;
  let error: jasmine.Spy;
  let insert: jasmine.Spy;

  beforeEach(async () => {
    exito = jasmine.createSpy('exito');
    error = jasmine.createSpy('error');
    insert = jasmine.createSpy('insert').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [LessonFormDialog],
      providers: [
        // El diálogo lee los parámetros de la URL para abrirse, y sus servicios de dominio
        // arrastran al cliente real de Supabase. Ninguna de las dos cosas hace falta para
        // comprobar que se monta.
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: {} } },
        { provide: NotificationService, useValue: { exito, error } },
        {
          provide: LessonService,
          useValue: {
            insert,
            update: jasmine.createSpy('update'),
            delete: jasmine.createSpy('delete'),
            getById: () => Promise.resolve({}),
            refreshTrigger: signal(0),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Antes de los avisos, estas escrituras no tenían `catch`: un fallo dejaba el diálogo abierto,
   * mudo, con una promesa rechazada sin recoger. Que NO navegue es lo que permite reintentar sin
   * volver a teclear.
   */
  it('avisa y no cierra el diálogo si falla el guardado', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    insert.and.rejectWith(new Error('permission denied'));
    component.lessonForm.patchValue({ name: 'Prueba', module_id: 1 });

    component.onSubmit();
    await fixture.whenStable();

    expect(error).toHaveBeenCalledWith('No se pudo guardar el subtema', 'permission denied');
    expect(exito).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
