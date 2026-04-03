import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '@shared/components/sidebar/sidebar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, Sidebar, BreadcrumbModule, DividerModule],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {
  breadcrumbItems: MenuItem[] = [
    { label: 'Components' },
    { label: 'Form' },
    { label: 'InputText', routerLink: '/inputtext' },
  ];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/' };
}
