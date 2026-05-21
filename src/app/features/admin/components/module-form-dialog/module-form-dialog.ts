import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-module-form-dialog',
  imports: [DialogModule, ButtonModule, InputTextModule],
  templateUrl: './module-form-dialog.html',
  styleUrl: './module-form-dialog.scss',
})
export class ModuleFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  pigcctForm!: FormGroup;
  isEditForm!: boolean;

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.pigcctForm = this.formBuilder.group({
      nombre: [undefined, Validators.required],
    });
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }
}
