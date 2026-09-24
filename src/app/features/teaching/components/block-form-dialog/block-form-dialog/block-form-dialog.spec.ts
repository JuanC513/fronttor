import { ComponentFixture, TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { BlockFormDialog } from './block-form-dialog';

describe('BlockFormDialog', () => {
  let component: BlockFormDialog;
  let fixture: ComponentFixture<BlockFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockFormDialog],
      providers: [
        // Lee los parámetros de la URL para abrirse, y sus servicios de dominio arrastran al
        // cliente real de Supabase. Ninguna de las dos cosas hace falta para comprobar el montaje.
        provideRouter([]),
        // Previsualiza el markdown del bloque; ngx-markdown se registra en `app.config.ts`.
        importProvidersFrom(MarkdownModule.forRoot()),
        { provide: SupabaseService, useValue: { client: {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
