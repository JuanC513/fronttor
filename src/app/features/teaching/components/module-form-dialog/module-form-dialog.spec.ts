import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '@core/services/notification/notification-service';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { ModuleService } from '@domain/learning/services/module-service';

import { ModuleFormDialog } from './module-form-dialog';

describe('ModuleFormDialog', () => {
  let component: ModuleFormDialog;
  let fixture: ComponentFixture<ModuleFormDialog>;
  let exito: jasmine.Spy;
  let error: jasmine.Spy;
  let insert: jasmine.Spy;

  beforeEach(async () => {
    exito = jasmine.createSpy('exito');
    error = jasmine.createSpy('error');
    insert = jasmine.createSpy('insert').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleFormDialog],
      providers: [
        // Lee los parámetros de la URL para abrirse, y sus servicios de dominio arrastran al
        // cliente real de Supabase. Ninguna de las dos cosas hace falta para comprobar el montaje.
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: {} } },
        { provide: NotificationService, useValue: { exito, error } },
        {
          provide: ModuleService,
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

    fixture = TestBed.createComponent(ModuleFormDialog);
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
    component.moduleForm.patchValue({ nombre: 'Prueba' });

    component.onSubmit();
    await fixture.whenStable();

    expect(error).toHaveBeenCalledWith('No se pudo guardar el tema', 'permission denied');
    expect(exito).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
