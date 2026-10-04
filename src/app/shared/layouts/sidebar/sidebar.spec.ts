import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { of } from 'rxjs';

import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;

  /**
   * Se sustituye `AuthService` por un doble para no arrastrar a `SupabaseService`, que en su
   * constructor abre sesión contra la red. Ambos roles activos a la vez para ver el menú completo,
   * que es donde pueden chocar los enlaces.
   */
  const buildSidebar = async (roles: { student: boolean; teacher: boolean }) => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        // El menu renderiza `routerLink`, que exige un Router real en el inyector.
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isStudent$: of(roles.student),
            isTeacher$: of(roles.teacher),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    return component;
  };

  const linksOf = (sidebar: Sidebar) =>
    [...sidebar.mainItems(), ...sidebar.aditionalItems()].map((item) => item.routerLink as string);

  beforeEach(async () => {
    await buildSidebar({ student: true, teacher: true });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * El invariante que hace correcto el resaltado. PrimeNG marca el ítem activo comparando la URL
   * actual con el `routerLink` por PREFIJO de segmentos, no por igualdad: si el enlace de un ítem
   * es prefijo del de otro, estando en el segundo se encienden los dos. Fue exactamente lo que
   * pasó cuando «Aprender» apuntaba a `/learning` y «Ejercicios» a `/learning/exercises`.
   *
   * Se comprueba la propiedad en vez de las cadenas concretas para que el test siga siendo válido
   * cuando se añadan ítems o se muevan rutas.
   */
  it('no deja que el enlace de un ítem sea prefijo del de otro', async () => {
    const links = linksOf(await buildSidebar({ student: true, teacher: true }));

    const segments = (link: string) => link.split('/').filter(Boolean);

    for (const link of links) {
      for (const other of links) {
        if (link === other) continue;

        const own = segments(link);
        const theirs = segments(other);
        const isPrefix = own.every((segment, index) => theirs[index] === segment);

        expect(isPrefix)
          .withContext(`"${link}" es prefijo de "${other}": ambos se resaltarían a la vez`)
          .toBeFalse();
      }
    }
  });

  it('manda «Aprender» a la ruta concreta de módulos, no a la raíz de la feature', async () => {
    const sidebar = await buildSidebar({ student: true, teacher: false });
    const aprender = sidebar.mainItems().find((item) => item.label === 'Aprender');

    expect(aprender?.routerLink).toBe('/learning/modules');
  });

  it('oculta las entradas de estudiante a quien no lo es', async () => {
    const sidebar = await buildSidebar({ student: false, teacher: true });

    expect(linksOf(sidebar)).not.toContain('/learning/exercises');
  });

  afterEach(() => TestBed.resetTestingModule());
});
