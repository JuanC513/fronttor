import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Module } from '@domain/learning/models/module-model';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-lesson-form-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    SelectModule,
    FloatLabelModule,
  ],
  templateUrl: './lesson-form-dialog.html',
  styleUrl: './lesson-form-dialog.scss',
})
export class LessonFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly lessonService = inject(LessonService);
  private readonly moduleService = inject(ModuleService);
  modulesList = signal<Module[]>([]);
  lessonForm!: FormGroup;
  isEditForm!: boolean;

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.lessonForm = this.formBuilder.group({
      name: [undefined, Validators.required],
      module_id: [undefined, Validators.required],
    });

    this.loadModules();
    if (id) {
      this.loadSubmodule(Number(id));
    }
  }

  private async loadSubmodule(id: number): Promise<void> {
    try {
      const data = await this.lessonService.getById(id);
      this.lessonForm.patchValue(data);
    } catch (err) {
      console.error('No se pudo cargar el subtema. Intenta de nuevo. ' + err);
    }
  }

  private async loadModules(): Promise<void> {
    try {
      const data = await this.moduleService.getAll();
      this.modulesList.set(data);
    } catch (err) {
      console.error('No se pudo cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  onSubmit() {
    console.log(this.lessonForm.value);
    console.log(this.lessonForm.valid);
    return;
    if (this.lessonForm.valid) {
      if (this.isEditForm) {
        // const id = this.activatedRoute.snapshot.paramMap.get('id');
        // this.lessonService.update(Number(id), this.lessonForm.value.nombre).then(() => {
        //   this.router.navigate(['/admin']);
        // });
        console.log('Editar');
      } else {
        this.lessonService
          .insert(this.lessonForm.value.name, this.lessonForm.value.module_id)
          .then(() => {
            this.router.navigate(['/admin']);
          });
      }
    }
  }
}
