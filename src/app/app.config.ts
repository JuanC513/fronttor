import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { importProvidersFrom } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Global, y es la excepción al `ConfirmationService` que cada vista provee por su cuenta.
    // Aquel se ancla a un botón y muere con el componente; el toast tiene que sobrevivir a quien lo
    // emite, porque los diálogos del profesor se destruyen justo al guardar. PrimeNG no lo declara
    // `providedIn: 'root'`, así que sin esta línea no se puede inyectar.
    MessageService,
    importProvidersFrom(MarkdownModule.forRoot()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.dark-mode' },
      },
    }),
  ],
};
