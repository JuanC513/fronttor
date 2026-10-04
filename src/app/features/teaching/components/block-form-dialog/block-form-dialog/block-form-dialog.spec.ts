import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { NotificationService } from '@core/services/notification/notification-service';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { BlockService } from '@domain/learning/services/block-service';

import { BlockFormDialog } from './block-form-dialog';

describe('BlockFormDialog', () => {
  let component: BlockFormDialog;
  let fixture: ComponentFixture<BlockFormDialog>;
  let exito: jasmine.Spy;
  let error: jasmine.Spy;
  let insert: jasmine.Spy;

  beforeEach(async () => {
    exito = jasmine.createSpy('exito');
    error = jasmine.createSpy('error');
    insert = jasmine.createSpy('insert').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [BlockFormDialog],
      providers: [
        // Lee los parámetros de la URL para abrirse, y sus servicios de dominio arrastran al
        // cliente real de Supabase. Ninguna de las dos cosas hace falta para comprobar el montaje.
        provideRouter([]),
        // Previsualiza el markdown del bloque; ngx-markdown se registra en `app.config.ts`.
        importProvidersFrom(MarkdownModule.forRoot()),
        { provide: SupabaseService, useValue: { client: {} } },
        { provide: NotificationService, useValue: { exito, error } },
        {
          provide: BlockService,
          useValue: {
            insert,
            update: jasmine.createSpy('update'),
            delete: jasmine.createSpy('delete'),
            getById: () => Promise.resolve({}),
            getAll: () => Promise.resolve([]),
            refreshTrigger: signal(0),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockFormDialog);
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
    component.blockForm.get('lesson_id')!.enable();
    component.blockForm.patchValue({ name: 'Prueba', lesson_id: 1, content: '# Prueba' });

    component.onSubmit();
    await fixture.whenStable();

    expect(error).toHaveBeenCalledWith('No se pudo guardar el bloque', 'permission denied');
    expect(exito).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
