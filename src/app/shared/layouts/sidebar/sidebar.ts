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
  private isAdmin = toSignal(this.authService.isAdmin$, { initialValue: false });

  readonly mainItems = computed<MenuItem[]>(() => {
    const showLabel = !this.popupMenuMode();
    const items: MenuItem[] = [
      { icon: 'pi pi-home', routerLink: '/home', label: 'Inicio' },
      { icon: 'pi pi-graduation-cap', routerLink: '/learning', label: 'Aprender' },
      { icon: 'pi pi-file-edit', routerLink: '/exercises', label: 'Ejercicios' },
      { icon: 'pi pi-code', routerLink: '/playground', label: 'Libre' },
    ];

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

    if (this.isAdmin()) {
      items.push({
        label: 'Administración',
        icon: 'pi pi-user-edit',
        routerLink: '/admin',
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
