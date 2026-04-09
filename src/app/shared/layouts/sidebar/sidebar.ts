import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { filter, Subscription } from 'rxjs';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-sidebar',
  imports: [ButtonModule, MenuModule, DividerModule, RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private routeMap: Record<string, string> = {
    home: 'Inicio',
    learning: 'Aprender',
    exercises: 'Ejercicios',
    playground: 'Libre',
  };
  private routerSubscription!: Subscription;

  items!: MenuItem[];
  popupMenuMode = signal<boolean>(false);

  ngOnInit(): void {
    this.items = [
      {
        label: 'Principal',
        items: [
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
        ],
      },
      {
        label: 'Práctica',
        items: [
          {
            label: 'Ejercicios',
            icon: 'pi pi-file-edit',
            routerLink: '/exercises',
          },
          {
            label: 'Libre',
            icon: 'pi pi-code',
            routerLink: '/playground',
            styleClass: 'active',
          },
        ],
      },
    ];

    this.setActiveItem(this.router.url);

    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.setActiveItem(event.urlAfterRedirects);
      });
  }

  private setActiveItem(url: string): void {
    const firstSegment = url.split('/').filter(Boolean)[0] ?? '';
    const activeLabel = this.routeMap[firstSegment];

    this.items.forEach((group) => {
      group.items!.forEach((item: MenuItem) => {
        item.styleClass = item.label === activeLabel ? 'active' : '';
      });
    });
  }

  switchSidebarMode() {
    this.popupMenuMode.update((s) => !s);
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }
}
