import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicationLegend } from './publication-legend';

describe('PublicationLegend', () => {
  let component: PublicationLegend;
  let fixture: ComponentFixture<PublicationLegend>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PublicationLegend] }).compileComponents();
    fixture = TestBed.createComponent(PublicationLegend);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('nombra los tres estados', () => {
    const texto = fixture.nativeElement.textContent;

    expect(texto).toContain('Publicado');
    expect(texto).toContain('Publicado pero no se muestra');
    expect(texto).toContain('Borrador');
  });

  /** La frase cambia entre pestañas, así que no puede estar escrita dentro de la plantilla. */
  it('muestra la frase que le pasen', () => {
    fixture.componentRef.setInput('hint', 'Los ejercicios se crean como borrador.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Los ejercicios se crean como borrador.');
  });

  /** Sin frase no debe quedar un párrafo vacío ocupando espacio bajo los iconos. */
  it('no pinta el párrafo si no hay frase', () => {
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
  });
});
