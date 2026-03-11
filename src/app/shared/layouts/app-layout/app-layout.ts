import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '@shared/components/sidebar/sidebar';

@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {}
