import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BreadcrumbService } from '@core/services/breadcrumb/breadcrumb-service';

import { Topbar } from './topbar';

describe('Topbar', () => {
  let component: Topbar;
  let fixture: ComponentFixture<Topbar>;
  let breadcrumbService: BreadcrumbService;
  let router: Router;

  /**
   * Se usa el router de verdad con una ruta comodín, y no un doble: la plantilla trae `routerLink`,
   * que necesita `ActivatedRoute` y varios métodos del `Router`. Doblarlo obligaría a describir esa
   * superficie entera para probar dos expresiones.
   *
   * La navegación va **antes** de crear el componente, porque la URL inicial de la miga se lee al
   * construirse.
   */
  const setup = async (urlInicial: string) => {
    TestBed.configureTestingModule({
      imports: [Topbar],
      providers: [provideRouter([{ path: '**', children: [] }])],
    });

    router = TestBed.inject(Router);
    await router.navigateByUrl(urlInicial);

    fixture = TestBed.createComponent(Topbar);
    component = fixture.componentInstance;
    breadcrumbService = TestBed.inject(BreadcrumbService);
    fixture.detectChanges();
  };

  const etiquetas = () => component.breadcrumbItems().map((item) => item.label);

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup('/home');
    expect(component).toBeTruthy();
  });

  it('no pinta miga en una sección que no la tiene', async () => {
    await setup('/home');
    expect(component.breadcrumbItems()).toEqual([]);
  });

  it('en una lista pinta un solo escalón, y sin enlace', async () => {
    await setup('/learning/modules');

    expect(etiquetas()).toEqual(['Módulos']);
    expect(component.breadcrumbItems()[0].routerLink).toBeUndefined();
  });

  it('reconoce también la lista de ejercicios', async () => {
    await setup('/learning/exercises');
    expect(etiquetas()).toEqual(['Ejercicios']);
  });

  /**
   * El nombre llega después de la navegación, cuando la vista termina de cargar. Hasta entonces se
   * pinta solo el padre: rellenar con un número desmentiría al título de la página, porque el
   * ejercicio con `id` 2 se llama «Ejercicio 01».
   */
  it('en un detalle sin nombre todavía, pinta solo el escalón padre', async () => {
    await setup('/learning/exercises/2');

    expect(etiquetas()).toEqual(['Ejercicios']);
    expect(component.breadcrumbItems()[0].routerLink).toBe('/learning/exercises');
  });

  it('extiende la miga cuando la vista publica su nombre', async () => {
    await setup('/learning/exercises/2');

    breadcrumbService.setTitle('Ejercicio 01');

    expect(etiquetas()).toEqual(['Ejercicios', 'Ejercicio 01']);
  });

  it('hace lo mismo con el detalle de un subtema', async () => {
    await setup('/learning/modules/1/lessons/2');
    breadcrumbService.setTitle('Elementos semánticos');

    expect(etiquetas()).toEqual(['Módulos', 'Elementos semánticos']);
    expect(component.breadcrumbItems()[0].routerLink).toBe('/learning/modules');
  });

  it('reconoce la práctica libre', async () => {
    await setup('/playground');
    expect(etiquetas()).toEqual(['Libre']);
  });

  /**
   * El único detalle con etiqueta fija: el ejercicio de la práctica guiada se genera y se descarta
   * con la pantalla, así que no hay entidad que nombrar. Por eso su escalón aparece de entrada, sin
   * esperar a que la vista publique nada.
   */
  it('nombra la práctica guiada sin que la vista publique nada', async () => {
    await setup('/playground/practice');

    expect(etiquetas()).toEqual(['Libre', 'Práctica guiada']);
    expect(component.breadcrumbItems()[0].routerLink).toBe('/playground');
  });

  it('la etiqueta fija manda sobre un nombre que haya quedado publicado', async () => {
    await setup('/playground/practice');

    breadcrumbService.setTitle('Ejercicio 01');

    expect(etiquetas()).toEqual(['Libre', 'Práctica guiada']);
  });

  it('sigue la navegación sin tener que rearmarse a mano', async () => {
    await setup('/learning/modules');

    await router.navigateByUrl('/learning/exercises');

    expect(etiquetas()).toEqual(['Ejercicios']);
  });

  /** Si el nombre viejo sobreviviera, se vería colgado en la miga de la pantalla siguiente. */
  it('el nombre publicado desaparece cuando la vista lo limpia', async () => {
    await setup('/learning/exercises/2');
    breadcrumbService.setTitle('Ejercicio 01');

    breadcrumbService.clear();
    await router.navigateByUrl('/learning/exercises');

    expect(etiquetas()).toEqual(['Ejercicios']);
  });
});
