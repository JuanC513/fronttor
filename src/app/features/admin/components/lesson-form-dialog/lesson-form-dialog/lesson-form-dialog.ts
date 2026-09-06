import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Block } from '@domain/learning/models/block-model';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { describeLessonImpact } from '@domain/learning/utils/publication-state';
import { FieldError } from '@shared/components/field-error/field-error';
import { publicationConfirmation } from '@shared/components/publication-field/publication-confirm';
import { PublicationField } from '@shared/components/publication-field/publication-field';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopup, ConfirmPopupModule } from 'primeng/confirmpopup';
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
    FieldError,
    PublicationField,
    ConfirmPopupModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './lesson-form-dialog.html',
  styleUrl: './lesson-form-dialog.scss',
})
export class LessonFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly lessonService = inject(LessonService);
  private readonly moduleService = inject(ModuleService);
  private readonly blockService = inject(BlockService);
  private readonly confirmationService = inject(ConfirmationService);
  modulesList = signal<ModuleWithLessons[]>([]);
  lessonForm!: FormGroup;
  isEditForm!: boolean;

  /** Ancla del `ConfirmPopup`: el diálogo se envía con Enter además de con el botón. */
  private readonly saveAnchor = viewChild<ElementRef<HTMLElement>>('saveAnchor');
  private readonly confirmPopup = viewChild(ConfirmPopup);

  /**
   * Si el `ConfirmPopup` está abierto, para inhabilitar los botones del formulario y dejar
   * activos solo los suyos.
   *
   * Se lee de su propia visibilidad y no de un indicador propio porque el popup también se
   * cierra con clic fuera, Escape, scroll y al cambiar el tamaño de la ventana, y esas vías
   * no invocan `reject`: un indicador manual se quedaría encendido y los botones,
   * inhabilitados para siempre.
   */
  readonly isConfirming = computed(() => this.confirmPopup()?.computedVisible() ?? false);

  /** El subtema tal como está guardado, para comparar contra lo que hay en el formulario. */
  private readonly savedLesson = signal<Lesson | null>(null);
  private readonly blocks = signal<Block[]>([]);
  private readonly pendingPublished = signal(false);

  readonly impact = computed(() => {
    const lesson = this.savedLesson();
    if (!lesson) return null;

    const module = this.modulesList().find((item) => item.id === lesson.module_id);
    if (!module) return null;

    return describeLessonImpact(
      {
        lesson,
        module,
        siblingLessons: module.lessons ?? [],
        blocks: this.blocks(),
      },
      this.pendingPublished(),
    );
  });

  get isPublishedControl(): FormControl<boolean> {
    return this.lessonForm.controls['is_published'] as FormControl<boolean>;
  }

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.lessonForm = this.formBuilder.group({
      name: [undefined, [Validators.required, Validators.maxLength(100)]],
      module_id: [undefined, Validators.required],
      // Nace en borrador: nada llega al estudiante sin un acto deliberado de publicar.
      is_published: [false],
    });

    this.isPublishedControl.valueChanges.subscribe((value) => this.pendingPublished.set(!!value));

    this.loadModules();
    if (id) {
      this.loadSubmodule(Number(id));
    } else {
      const { moduleId } = this.activatedRoute.snapshot.queryParams;

      if (moduleId) {
        this.lessonForm.patchValue({
          module_id: Number(moduleId),
        });
      }
    }
  }

  private async loadSubmodule(id: number): Promise<void> {
    try {
      // Los bloques hacen falta para poder decir cuántos dejarían de verse al despublicarlo.
      const [data, blocks] = await Promise.all([
        this.lessonService.getById(id),
        this.blockService.getAll(),
      ]);

      this.savedLesson.set(data);
      this.blocks.set(blocks);
      this.pendingPublished.set(data.is_published);
      this.lessonForm.patchValue(data);
    } catch (err) {
      console.error('No se pudo cargar el subtema. Intenta de nuevo. ' + err);
    }
  }

  private async loadModules(): Promise<void> {
    try {
      // Con sus subtemas: hay que saber si este es el único visible del tema, porque entonces el
      // tema entero desaparece con él.
      const data = await this.moduleService.getAllWithLessons();
      this.modulesList.set(data);
    } catch (err) {
      console.error('No se pudo cargar los temas. Intenta de nuevo. ' + err);
    }
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  /** Solo se confirma lo que deja de verse; publicar o editar el nombre se guardan sin más. */
  onSubmit() {
    if (this.lessonForm.invalid) return;

    const impact = this.impact();
    if (!impact?.hides) {
      void this.save();
      return;
    }

    this.confirmationService.confirm(
      publicationConfirmation(this.saveAnchor()?.nativeElement, () => void this.save()),
    );
  }

  private async save(): Promise<void> {
    const { name, module_id, is_published } = this.lessonForm.value;

    if (this.isEditForm) {
      const id = this.activatedRoute.snapshot.paramMap.get('id');
      await this.lessonService.update(Number(id), name, module_id, is_published);
    } else {
      await this.lessonService.insert(name, module_id, is_published);
    }

    this.router.navigate(['/admin']);
  }
}
