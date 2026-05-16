import { Component, inject, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DividerModule } from 'primeng/divider';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth/auth-service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-sidebar',
  imports: [ButtonModule, MenuModule, DividerModule, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  private readonly authService = inject(AuthService);
  private isAdmin = toSignal(this.authService.isAdmin$, { initialValue: false });

  mainItems: MenuItem[] = [
    {
      label: 'Inicio',
      icon: 'pi pi-home',
      routerLink: '/home',
    },
    {
      label: 'Aprender',
      icon: 'pi pi-graduation-cap',
      routerLink: '/learning',
    },
    {
      label: 'Ejercicios',
      icon: 'pi pi-file-edit',
      routerLink: '/exercises',
    },
    {
      label: 'Libre',
      icon: 'pi pi-code',
      routerLink: '/playground',
    },
  ];
  aditionalItems!: MenuItem[];
  popupMenuMode = signal<boolean>(false);

  ngOnInit(): void {
    this.aditionalItems = [
      {
        label: 'Perfil',
        icon: 'pi pi-user',
        routerLink: '/profile',
      },
    ];

    if (this.isAdmin()) {
      this.aditionalItems = [
        {
          label: 'Administración',
          icon: 'pi pi-user-edit',
          routerLink: '/admin',
        },
        ...this.aditionalItems,
      ];
    }
  }

  switchSidebarMode() {
    this.popupMenuMode.update((s) => !s);
  }
}
