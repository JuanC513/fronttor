import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { DividerModule } from 'primeng/divider';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-topbar',
  imports: [DividerModule, BreadcrumbModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  breadcrumbItems: MenuItem[] = [];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/home' };

  private sub!: Subscription;

  ngOnInit() {
    // Construir items para la ruta inicial
    this.breadcrumbItems = this.buildItems(this.router.url);

    // Escuchar cambios de ruta
    this.sub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.breadcrumbItems = this.buildItems((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private buildItems(url: string): MenuItem[] {
    const lessonMatch = url.match(/\/learning\/modules\/(\d+)\/lessons\/(\d+)/);
    if (lessonMatch) {
      const moduleLabel = +lessonMatch[1] + 1;
      const lessonLabel = +lessonMatch[2] + 1;
      return [
        { label: 'Módulos', routerLink: '/learning/modules' },
        { label: `Lección ${moduleLabel}.${lessonLabel}` },
      ];
    }

    if (url.startsWith('/learning/modules')) {
      return [{ label: 'Módulos' }];
    }

    return [];
  }
}
