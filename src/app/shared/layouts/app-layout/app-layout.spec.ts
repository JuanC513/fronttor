import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { AppLayout } from './app-layout';

describe('AppLayout', () => {
  let component: AppLayout;
  let fixture: ComponentFixture<AppLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [
        // El layout monta el `router-outlet`, la barra lateral y el panel de chat, así que
        // arrastra el router, la sesión y el cliente de Supabase. Se doblan los tres: aquí solo
        // se comprueba que el armazón se monta.
        provideRouter([]),
        { provide: AuthService, useValue: { isStudent$: of(true), isTeacher$: of(false) } },
        { provide: SupabaseService, useValue: { client: {} } },
        // El `p-toast` del layout lo necesita, y en la aplicación lo provee `app.config.ts`, que
        // los tests no cargan.
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
