import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth-service';

@Component({
  selector: 'app-login-page',
  imports: [],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async login() {
    try {
      await this.authService.signIn('student3@test.com', '12345678');

      this.router.navigate(['/']);
    } catch (error) {
      console.error('Login failed', error);

      // mostrar mensaje en UI
      alert('Credenciales incorrectas');
    }
  }

  async loginAdmin() {
    try {
      await this.authService.signIn('admin1@test.com', 'admin12345678');

      this.router.navigate(['/']);
    } catch (error) {
      console.error('Login failed', error);

      // mostrar mensaje en UI
      alert('Credenciales incorrectas');
    }
  }
}

// registrarse
// const user = await this.authService.signUp('prueba@test.com', 'prueba');
