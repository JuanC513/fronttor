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
import { Module } from '@domain/learning/models/module-model';
import { BlockService } from '@domain/learning/services/block-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { describeModuleImpact } from '@domain/learning/utils/publication-state';
import { FieldError } from '@shared/components/field-error/field-error';
import { publicationConfirmation } from '@shared/components/publication-field/publication-confirm';
import { PublicationField } from '@shared/components/publication-field/publication-field';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopup, ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-module-form-dialog',
  imports: [
    DialogModule,
    ButtonModule,
    InputTextModule,
    ReactiveFormsModule,
    FloatLabelModule,
    FieldError,
    PublicationField,
    ConfirmPopupModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './module-form-dialog.html',
  styleUrl: './module-form-dialog.scss',
})
export class ModuleFormDialog implements OnInit {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly moduleService = inject(ModuleService);
  private readonly blockService = inject(BlockService);
  private readonly confirmationService = inject(ConfirmationService);
  moduleForm!: FormGroup;
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

  /** El tema tal como está guardado, para comparar contra lo que hay en el formulario. */
  private readonly savedModule = signal<Module | null>(null);
  private readonly lessons = signal<Lesson[]>([]);
  private readonly blocks = signal<Block[]>([]);
  private readonly pendingPublished = signal(false);

  /** Qué implica dejar el interruptor como está. `null` mientras no se haya movido. */
  readonly impact = computed(() => {
    const module = this.savedModule();
    if (!module) return null;

    return describeModuleImpact(
      { module, lessons: this.lessons(), blocks: this.blocks() },
      this.pendingPublished(),
    );
  });

  get isPublishedControl(): FormControl<boolean> {
    return this.moduleForm.controls['is_published'] as FormControl<boolean>;
  }

  ngOnInit(): void {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.moduleForm = this.formBuilder.group({
      nombre: [undefined, [Validators.required, Validators.maxLength(100)]],
      // Nace en borrador: nada llega al estudiante sin un acto deliberado de publicar.
      is_published: [false],
    });

    this.isPublishedControl.valueChanges.subscribe((value) => this.pendingPublished.set(!!value));

    if (id) {
      this.loadModule(Number(id));
    }
  }

  private async loadModule(id: number): Promise<void> {
    try {
      // `getAllWithLessons` en vez de `getById` porque para explicar el efecto de despublicar hay
      // que saber cuántos subtemas y bloques se ocultarían con él.
      const [modules, blocks] = await Promise.all([
        this.moduleService.getAllWithLessons(),
        this.blockService.getAll(),
      ]);
      const data = modules.find((module) => module.id === id);
      if (!data) throw new Error('El tema ya no existe.');

      this.savedModule.set(data);
      this.lessons.set(data.lessons ?? []);
      this.blocks.set(blocks);
      this.pendingPublished.set(data.is_published);
      this.moduleForm.patchValue({ nombre: data.name, is_published: data.is_published });
    } catch (err) {
      console.error('No se pudo cargar el tema. Intenta de nuevo. ' + err);
    }
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  /** Solo se confirma lo que deja de verse; publicar o editar el nombre se guardan sin más. */
  onSubmit() {
    if (this.moduleForm.invalid) return;

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
    const { nombre, is_published } = this.moduleForm.value;

    if (this.isEditForm) {
      const id = this.activatedRoute.snapshot.paramMap.get('id');
      await this.moduleService.update(Number(id), nombre, is_published);
    } else {
      await this.moduleService.insert(nombre, is_published);
    }

    this.router.navigate(['/admin']);
  }
}
