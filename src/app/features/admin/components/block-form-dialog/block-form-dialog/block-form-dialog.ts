import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-block-form-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    FloatLabelModule,
    ReactiveFormsModule,
    MarkdownRenderer,
    TextareaModule,
  ],
  templateUrl: './block-form-dialog.html',
  styleUrl: './block-form-dialog.scss',
})
export class BlockFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly blockService = inject(BlockService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private lessonsSource = signal<Lesson[]>([]);
  selectedModuleId = signal<number | undefined>(undefined);
  modulesList = signal<ModuleWithLessons[]>([]);
  lessonsList = signal<Lesson[]>([]);
  blockForm!: FormGroup;
  uiForm!: FormGroup;
  isEditForm!: boolean;

  async ngOnInit() {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.blockForm = this.formBuilder.group({
      name: [undefined, Validators.required],
      lesson_id: [{ value: undefined, disabled: !this.isEditForm }, Validators.required],
      content: [undefined, Validators.required],
    });
    this.uiForm = this.formBuilder.group({
      module_id: [undefined, Validators.required],
    });

    this.loadModules();
    this.loadLessons();

    this.uiForm.get('module_id')?.valueChanges.subscribe((value) => {
      if (value) {
        if (value === this.selectedModuleId()) return;
        this.lessonsList.set(this.lessonsSource().filter((l) => l.module_id === value));
        this.blockForm.get('lesson_id')?.enable();
        this.blockForm.get('lesson_id')?.setValue(undefined);
      } else {
        this.lessonsList.set([]);
        this.blockForm.get('lesson_id')?.disable();
      }
    });

    if (id) {
      this.loadBlock(Number(id));
    } else {
      const { moduleId, lessonId } = this.activatedRoute.snapshot.queryParams;

      if (moduleId && lessonId) {
        this.uiForm.patchValue({
          module_id: Number(moduleId),
        });
        this.blockForm.patchValue({
          lesson_id: Number(lessonId),
        });
      }
    }
  }

  private async loadBlock(id: number): Promise<void> {
    try {
      const data = await this.blockService.getById(id);
      this.blockForm.patchValue(data);
      const currentModuleId = this.lessonsList().find((l) => l.id === data.lesson_id)?.module_id;
      this.uiForm.patchValue({ module_id: currentModuleId }, { emitEvent: false });
      this.selectedModuleId.set(currentModuleId);
    } catch (err) {
      console.error('No se pudo cargar el bloque. Intenta de nuevo. ' + err);
    }
  }

  private async loadModules(): Promise<void> {
    try {
      const data = await this.moduleService.getAllWithLessons();
      this.modulesList.set(data);
    } catch (err) {
      console.error('No se pudo cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  private async loadLessons(): Promise<void> {
    try {
      const data = await this.lessonService.getAll();
      this.lessonsList.set(data);
      this.lessonsSource.set(data);
    } catch (err) {
      console.error('No se pudo cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  onSubmit() {
    if (this.blockForm.valid) {
      if (this.isEditForm) {
        const id = this.activatedRoute.snapshot.paramMap.get('id');
        this.blockService
          .update(
            Number(id),
            this.blockForm.value.name,
            this.blockForm.value.content,
            this.blockForm.value.lesson_id,
          )
          .then(() => {
            this.router.navigate(['/admin']);
          });
      } else {
        this.blockService
          .insert(
            this.blockForm.value.name,
            this.blockForm.value.content,
            this.blockForm.value.lesson_id,
          )
          .then(() => {
            this.router.navigate(['/admin']);
          });
      }
    }
  }
}
