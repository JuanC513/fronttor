import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AiService } from '@domain/ai/services/ai-service';
import { Block } from '@domain/learning/models/block-model';
import { Lesson } from '@domain/learning/models/lesson-model';
import { ModuleWithLessons } from '@domain/learning/models/module-with-lessons';
import { BlockService } from '@domain/learning/services/block-service';
import { LessonService } from '@domain/learning/services/lesson-service';
import { ModuleService } from '@domain/learning/services/module-service';
import { describeBlockImpact } from '@domain/learning/utils/publication-state';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmPopup, ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { MarkdownRenderer } from '@shared/components/markdown-renderer/markdown-renderer';
import { MarkdownCheatsheet } from '@shared/components/markdown-cheatsheet/markdown-cheatsheet';
import { deleteConfirmation, UNPUBLISH_INSTEAD } from '@features/admin/utils/delete-confirmation';
import { FieldError } from '@shared/components/field-error/field-error';
import { publicationConfirmation } from '@shared/components/publication-field/publication-confirm';
import { PublicationField } from '@shared/components/publication-field/publication-field';
import { TextareaModule } from 'primeng/textarea';

type ConfirmKind = 'publication' | 'delete' | 'ai' | null;

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
    MarkdownCheatsheet,
    TextareaModule,
    FieldError,
    MessageModule,
    ConfirmPopupModule,
    PublicationField,
  ],
  providers: [ConfirmationService],
  templateUrl: './block-form-dialog.html',
  styleUrl: './block-form-dialog.scss',
})
export class BlockFormDialog implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly blockService = inject(BlockService);
  private readonly moduleService = inject(ModuleService);
  private readonly lessonService = inject(LessonService);
  private readonly aiService = inject(AiService);
  private readonly confirmationService = inject(ConfirmationService);
  private lessonsSource = signal<Lesson[]>([]);
  selectedModuleId = signal<number | undefined>(undefined);
  modulesList = signal<ModuleWithLessons[]>([]);
  lessonsList = signal<Lesson[]>([]);
  blockForm!: FormGroup;
  uiForm!: FormGroup;
  isEditForm!: boolean;

  /** Ancla del `ConfirmPopup` de guardado: el diálogo se envía con Enter además de con el botón. */
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

  /** Un bloque no cuelga de nada, asi que se lleva solo su contenido. */
  private readonly deleteMessage = computed(() => {
    const block = this.savedBlock();
    if (!block) return '';

    return `Se borrará «${block.name}» y su contenido de forma permanente. ${UNPUBLISH_INSTEAD}`;
  });

  /** El bloque tal como está guardado, para comparar contra lo que hay en el formulario. */
  private readonly savedBlock = signal<Block | null>(null);
  private readonly siblingBlocks = signal<Block[]>([]);
  private readonly pendingPublished = signal(false);

  readonly impact = computed(() => {
    const block = this.savedBlock();
    if (!block) return null;

    const lesson = this.lessonsSource().find((item) => item.id === block.lesson_id);
    const module = this.modulesList().find((item) => item.id === lesson?.module_id);
    if (!lesson || !module) return null;

    return describeBlockImpact(
      { block, lesson, module, siblingBlocks: this.siblingBlocks() },
      this.pendingPublished(),
    );
  });

  get isPublishedControl(): FormControl<boolean> {
    return this.blockForm.controls['is_published'] as FormControl<boolean>;
  }

  readonly showAiPanel = signal(false);
  readonly isGenerating = signal(false);
  readonly generationError = signal<string | null>(null);
  /** Controla la generación en curso, para poder abortarla si el diálogo se cierra antes. */
  private generationController: AbortController | null = null;

  async ngOnInit() {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditForm = !!id;

    this.blockForm = this.formBuilder.group({
      name: [undefined, [Validators.required, Validators.maxLength(100)]],
      lesson_id: [{ value: undefined, disabled: !this.isEditForm }, Validators.required],
      // El tope es generoso a propósito: es markdown de un bloque completo, con ejemplos
      // de código incluidos, no una sola idea corta.
      content: [undefined, [Validators.required, Validators.maxLength(20_000)]],
      // Nace en borrador: nada llega al estudiante sin un acto deliberado de publicar.
      is_published: [false],
    });

    this.isPublishedControl.valueChanges.subscribe((value) => this.pendingPublished.set(!!value));
    // `uiForm` agrupa lo que no se persiste: el tema (solo filtra los subtemas) y la
    // indicación que el admin le da a la IA.
    this.uiForm = this.formBuilder.group({
      module_id: [undefined, Validators.required],
      // Debe coincidir con MAX_INSTRUCCION_LENGTH en
      // supabase/functions/_shared/prompts/content-prompt.ts — lo hace cumplir
      // scripts/check-prompt-limits-sync.mjs, que corre en cada commit.
      instruccion: [undefined, Validators.maxLength(2_000)],
    });

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

    // Se esperan las dos cargas antes de aplicar ningún valor al formulario.
    //
    // No es un detalle de estilo: el suscriptor de arriba filtra los subtemas leyendo
    // `lessonsSource()`, y si todavía está vacío cuando llega el tema, deja la lista en cero. Acto
    // seguido `loadLessons()` resuelve y la rellena ENTERA, sin filtrar, de modo que el desplegable
    // acababa ofreciendo los subtemas de todos los temas mientras el selector de arriba mostraba
    // uno solo — y se podía elegir un subtema que no le pertenece.
    await Promise.all([this.loadModules(), this.loadLessons()]);

    if (id) {
      await this.loadBlock(Number(id));
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
      // Los hermanos hacen falta para saber si es el último bloque publicado del subtema, que es
      // el caso en el que despublicarlo se lleva el subtema entero por delante.
      this.savedBlock.set(data);
      this.siblingBlocks.set(await this.blockService.getAllByLessonId(data.lesson_id));
      this.pendingPublished.set(data.is_published);
      this.blockForm.patchValue(data);
      const currentModuleId = this.lessonsSource().find((l) => l.id === data.lesson_id)?.module_id;
      // Sin emitir: el suscriptor de `module_id` limpia el subtema al cambiar de tema, y aquí el
      // subtema es justo el del bloque que se está editando. A cambio hay que filtrar la lista a
      // mano, que es lo que el suscriptor habría hecho.
      this.uiForm.patchValue({ module_id: currentModuleId }, { emitEvent: false });
      this.lessonsList.set(this.lessonsSource().filter((l) => l.module_id === currentModuleId));
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

  /** La IA necesita tema, subtema y nombre del bloque para tener contexto suficiente. */
  get canGenerate(): boolean {
    return (
      !!this.uiForm.get('module_id')?.value &&
      !!this.blockForm.get('lesson_id')?.value &&
      !!this.blockForm.get('name')?.value
    );
  }

  toggleAiPanel(): void {
    this.showAiPanel.update((visible) => !visible);
    this.generationError.set(null);
  }

  /** Pide confirmación solo si hay contenido que se perdería al reemplazarlo. */
  onGenerateClick(event: Event): void {
    const currentContent: string = this.blockForm.get('content')?.value ?? '';

    if (currentContent.trim().length === 0) {
      void this.generateContent();
      return;
    }

    this.confirmKind.set('ai');
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Ya escribiste contenido en este bloque. ¿Reemplazarlo por el que genere la IA?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Reemplazar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: {
        variant: 'outlined',
      },
      accept: () => void this.generateContent(),
    });
  }

  private async generateContent(): Promise<void> {
    const moduleId = this.uiForm.get('module_id')?.value;
    const lessonId = this.blockForm.get('lesson_id')?.value;
    const nombreBloque = this.blockForm.get('name')?.value;

    const tema = this.modulesList().find((module) => module.id === moduleId)?.name;
    const subtema = this.lessonsSource().find((lesson) => lesson.id === lessonId)?.name;

    if (!tema || !subtema || !nombreBloque) return;

    const controller = new AbortController();
    this.generationController = controller;
    this.isGenerating.set(true);
    this.generationError.set(null);

    try {
      const contenido = await this.aiService.generateBlockContent(
        {
          tema,
          subtema,
          nombreBloque,
          bloquesExistentes: await this.loadSiblingBlockNames(lessonId),
          instruccion: this.uiForm.get('instruccion')?.value || undefined,
        },
        controller.signal,
      );
      this.blockForm.patchValue({ content: contenido });
    } catch (err) {
      if (controller.signal.aborted) return;
      this.generationError.set(err instanceof Error ? err.message : String(err));
    } finally {
      if (this.generationController === controller) {
        this.generationController = null;
        this.isGenerating.set(false);
      }
    }
  }

  /**
   * Nombres de los otros bloques del subtema, para que la IA no repita lo ya cubierto.
   * Es contexto opcional: si la consulta falla se genera igual, sin esa ayuda.
   */
  private async loadSiblingBlockNames(lessonId: number): Promise<string[]> {
    const currentBlockId = Number(this.activatedRoute.snapshot.paramMap.get('id'));

    try {
      const blocks = await this.blockService.getAllByLessonId(lessonId);
      return blocks.filter((block) => block.id !== currentBlockId).map((block) => block.name);
    } catch {
      return [];
    }
  }

  /**
   * Cerrar el diálogo navega fuera y destruye el componente, pero el `fetch` de la Edge
   * Function no está atado a ese ciclo de vida.
   */
  ngOnDestroy(): void {
    this.generationController?.abort();
    this.generationController = null;
  }

  closeDialog() {
    this.router.navigate(['/admin']);
  }

  /** Solo se confirma lo que deja de verse; publicar o editar el contenido se guardan sin más. */
  onSubmit() {
    // El botón ya está deshabilitado mientras se genera, pero el `(ngSubmit)` del form
    // también se dispara con Enter desde los inputs; guardar aquí evitaría persistir un
    // contenido que la IA está a punto de reemplazar.
    if (this.isGenerating()) return;
    if (this.blockForm.invalid) return;

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

  /** Un bloque no cuelga de nada, asi que se lleva solo su contenido. */
  onDelete(): void {
    const block = this.savedBlock();
    if (!block) return;

    this.confirmKind.set('delete');
    this.confirmationService.confirm(
      deleteConfirmation(this.deleteAnchor()?.nativeElement, () => void this.remove(block.id)),
    );
  }

  private async remove(id: number): Promise<void> {
    await this.blockService.delete(id);
    this.router.navigate(['/admin']);
  }

  private async save(): Promise<void> {
    const { name, content, lesson_id, is_published } = this.blockForm.value;

    if (this.isEditForm) {
      const id = this.activatedRoute.snapshot.paramMap.get('id');
      await this.blockService.update(Number(id), name, content, lesson_id, is_published);
    } else {
      await this.blockService.insert(name, content, lesson_id, is_published);
    }

    this.router.navigate(['/admin']);
  }
}
