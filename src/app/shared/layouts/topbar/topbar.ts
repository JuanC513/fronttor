import { Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-topbar',
  imports: [DividerModule, BreadcrumbModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  breadcrumbItems: MenuItem[] = [
    { label: 'Components' },
    { label: 'Form' },
    { label: 'InputText', routerLink: '/inputtext' },
  ];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/home' };
}
