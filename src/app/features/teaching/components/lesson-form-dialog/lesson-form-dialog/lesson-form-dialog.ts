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
import {
  deleteConfirmation,
  UNPUBLISH_INSTEAD,
} from '@features/teaching/utils/delete-confirmation';
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

type ConfirmKind = 'publication' | 'delete' | null;

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
  private readonly deleteAnchor = viewChild<ElementRef<HTMLElement>>('deleteAnchor');
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

  /**
   * Que confirmacion esta abierta, para que cada una resalte lo suyo.
   *
   * Basta con anotarla al abrirla, sin reiniciarla: solo se lee mientras el popup esta abierto, y
   * de eso ya se encarga `isConfirming`.
   */
  private readonly confirmKind = signal<ConfirmKind>(null);

  /** El aviso de publicacion se realza solo si el popup abierto es el suyo. */
  readonly highlightImpact = computed(
    () => this.isConfirming() && this.confirmKind() === 'publication',
  );

  /** Ocupa el hueco del aviso de publicacion mientras se pregunta por el borrado. */
  readonly deleteNotice = computed(() =>
    this.isConfirming() && this.confirmKind() === 'delete' ? this.deleteMessage() : null,
  );

  /**
   * Arrastra bloques y ejercicios, y con los ejercicios los intentos y el progreso que los
   * estudiantes hayan acumulado en este subtema.
   */
  private readonly deleteMessage = computed(() => {
    const lesson = this.savedLesson();
    if (!lesson) return '';

    const blocks = this.blocks().filter((block) => block.lesson_id === lesson.id).length;
    const cascade = blocks
      ? ` Se borrarán con él sus ${blocks} bloques y sus ejercicios, junto con los intentos y el` +
        ' progreso que los estudiantes tengan en ellos.'
      : ' Se borrarán también sus ejercicios y el progreso de los estudiantes en este subtema.';

    return `Se borrará «${lesson.name}» de forma permanente.${cascade} ${UNPUBLISH_INSTEAD}`;
  });

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
    this.router.navigate(['/teaching']);
  }

  /** Solo se confirma lo que deja de verse; publicar o editar el nombre se guardan sin más. */
  onSubmit() {
    if (this.lessonForm.invalid) return;

    const impact = this.impact();
    if (!impact?.hides) {
      void this.save();
      return;
    }

    this.confirmKind.set('publication');
    this.confirmationService.confirm(
      publicationConfirmation(this.saveAnchor()?.nativeElement, () => void this.save()),
    );
  }

  /**
   * Arrastra bloques y ejercicios, y con los ejercicios los intentos y el progreso que los
   * estudiantes hayan acumulado en este subtema.
   */
  onDelete(): void {
    const lesson = this.savedLesson();
    if (!lesson) return;

    this.confirmKind.set('delete');
    this.confirmationService.confirm(
      deleteConfirmation(this.deleteAnchor()?.nativeElement, () => void this.remove(lesson.id)),
    );
  }

  private async remove(id: number): Promise<void> {
    await this.lessonService.delete(id);
    this.router.navigate(['/teaching']);
  }

  private async save(): Promise<void> {
    const { name, module_id, is_published } = this.lessonForm.value;

    if (this.isEditForm) {
      const id = this.activatedRoute.snapshot.paramMap.get('id');
      await this.lessonService.update(Number(id), name, module_id, is_published);
    } else {
      await this.lessonService.insert(name, module_id, is_published);
    }

    this.router.navigate(['/teaching']);
  }
}
