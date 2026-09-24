import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { TeachingContent } from './teaching-content';

describe('TeachingContent', () => {
  let component: TeachingContent;
  let fixture: ComponentFixture<TeachingContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeachingContent],
      providers: [
        // Lee los parámetros de la URL para abrirse, y sus servicios de dominio arrastran al
        // cliente real de Supabase. Ninguna de las dos cosas hace falta para comprobar el montaje.
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeachingContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
