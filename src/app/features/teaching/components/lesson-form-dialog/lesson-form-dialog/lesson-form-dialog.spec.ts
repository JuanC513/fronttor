import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { LessonFormDialog } from './lesson-form-dialog';

describe('LessonFormDialog', () => {
  let component: LessonFormDialog;
  let fixture: ComponentFixture<LessonFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonFormDialog],
      providers: [
        // El diálogo lee los parámetros de la URL para abrirse, y sus servicios de dominio
        // arrastran al cliente real de Supabase. Ninguna de las dos cosas hace falta para
        // comprobar que se monta.
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
