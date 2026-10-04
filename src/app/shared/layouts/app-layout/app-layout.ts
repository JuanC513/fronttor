import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AiChatPanel } from '@shared/components/ai-chat-panel/ai-chat-panel';
import { ToastModule } from 'primeng/toast';
import { Topbar } from '../topbar/topbar';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-app-layout',
  imports: [RouterOutlet, Sidebar, Topbar, AiChatPanel, ToastModule],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {}
