import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-module-form-dialog',
  imports: [DialogModule, ButtonModule, InputTextModule, ReactiveFormsModule],
  templateUrl: './module-form-dialog.html',
  styleUrl: './module-form-dialog.scss',
})
export class ModuleFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly moduleService = inject(ModuleService);
  moduleForm!: FormGroup;
  isEditForm!: boolean;

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.moduleForm = this.formBuilder.group({
      nombre: [undefined, Validators.required],
    });

    if (id) {
      this.loadModule(Number(id));
    }
  }

  private async loadModule(id: number): Promise<void> {
    try {
      const data = await this.moduleService.getById(id);
      this.moduleForm.patchValue({ nombre: data.name });
    } catch (err) {
      console.error('No se pudieron cargar los módulos. Intenta de nuevo. ' + err);
    }
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  onSubmit() {
    if (this.moduleForm.valid) {
      if (this.isEditForm) {
        const id = this.activatedRoute.snapshot.paramMap.get('id');
        this.moduleService.update(Number(id), this.moduleForm.value.nombre).then(() => {
          this.router.navigate(['/admin']);
        });
      } else {
        console.log('crear');
        this.moduleService.insert(this.moduleForm.value.nombre).then(() => {
          this.router.navigate(['/admin']);
        });
      }
    }
  }
}
