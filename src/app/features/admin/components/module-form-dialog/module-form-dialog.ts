import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-module-form-dialog',
  imports: [DialogModule, ButtonModule, InputTextModule],
  templateUrl: './module-form-dialog.html',
  styleUrl: './module-form-dialog.scss',
})
export class ModuleFormDialog {
  private readonly router = inject(Router);

  closeDialog() {
    this.router.navigate(['/admin']);
  }
}
