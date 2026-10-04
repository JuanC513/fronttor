import { Component, computed, inject, signal } from '@angular/core';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth/auth-service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-sidebar',
  imports: [MenuModule, DividerModule, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly authService = inject(AuthService);
  private isTeacher = toSignal(this.authService.isTeacher$, { initialValue: false });
  private isStudent = toSignal(this.authService.isStudent$, { initialValue: false });

  readonly mainItems = computed<MenuItem[]>(() => {
    const showLabel = !this.popupMenuMode();
    const items: MenuItem[] = [{ icon: 'pi pi-home', routerLink: '/home', label: 'Inicio' }];

    // El recorrido del curso pertenece a la vista del estudiante, que ahora exige ese rol. Sin
    // esta condición el menú ofrecería puertas que el guard cierra a continuación.
    if (this.isStudent()) {
      // Ambos enlaces apuntan a rutas concretas y hermanas, no a la raíz de la feature. PrimeNG
      // marca el ítem activo por PREFIJO de ruta (`routerLinkActiveOptions: { exact: false }`),
      // así que un enlace a `/learning` se encendería también estando en `/learning/exercises`.
      // Apuntando a `/learning/modules`, cada ítem se enciende solo en lo suyo y «Aprender» sigue
      // activo dentro de una lección, cuya URL cuelga de él. Es la diferencia con forzar
      // `exact: true`, que apagaría «Aprender» justo cuando el estudiante está leyendo.
      items.push(
        { icon: 'pi pi-graduation-cap', routerLink: '/learning/modules', label: 'Aprender' },
        { icon: 'pi pi-file-edit', routerLink: '/learning/exercises', label: 'Ejercicios' },
      );
    }

    items.push({ icon: 'pi pi-code', routerLink: '/playground', label: 'Libre' });

    return items.map((item) => {
      if (showLabel) return item;

      const itemWithoutLabel = { ...item };
      delete itemWithoutLabel.label;
      return itemWithoutLabel;
    });
  });

  readonly aditionalItems = computed<MenuItem[]>(() => {
    const showLabel = !this.popupMenuMode();
    const items: MenuItem[] = [];

    if (this.isTeacher()) {
      items.push({
        label: 'Enseñar',
        icon: 'pi pi-user-edit',
        routerLink: '/teaching',
      });
    }

    items.push({
      label: 'Perfil',
      icon: 'pi pi-user',
      routerLink: '/profile',
    });

    return items.map((item) => {
      if (showLabel) return item;

      const itemWithoutLabel = { ...item };
      delete itemWithoutLabel.label;
      return itemWithoutLabel;
    });
  });

  popupMenuMode = signal<boolean>(false);

  switchSidebarMode() {
    this.popupMenuMode.update((s) => !s);
  }
}
