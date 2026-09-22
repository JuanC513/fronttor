import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

/**
 * Debe coincidir con MAX_INSTRUCCION_LENGTH en
 * supabase/functions/_shared/prompts/exercise-prompt.ts — lo hace cumplir
 * scripts/check-prompt-limits-sync.mjs, que corre en cada commit.
 */
export const MAX_INSTRUCCION_LENGTH = 2_000;

/**
 * Lo que hace falta para generar: la indicación y el botón que la pidió.
 *
 * El elemento viaja con el evento para que quien confirme pueda anclar su popup al botón que se
 * acaba de pulsar. Hay cuatro paneles montados a la vez, uno por pestaña, así que el padre no
 * puede deducir cuál fue desde fuera.
 */
export interface GenerateRequest {
  instruccion: string;
  target: HTMLElement;
}

/**
 * Panel de generación con IA, uno por pestaña del formulario de ejercicio.
 *
 * Las cuatro tienen la misma forma —una indicación libre, el botón y el error— y solo cambian el
 * texto, así que se extrae en vez de repetirlo cuatro veces. La instrucción la lleva el propio
 * panel: es de usar y tirar, no se guarda con el ejercicio, y no tiene por qué ensuciar el
 * formulario que sí se persiste.
 */
@Component({
  selector: 'app-ai-generate-panel',
  imports: [ButtonModule, FloatLabelModule, FormsModule, MessageModule, TextareaModule],
  templateUrl: './ai-generate-panel.html',
  styleUrl: './ai-generate-panel.scss',
})
export class AiGeneratePanel {
  /** Identifica los controles cuando hay varios paneles montados a la vez. */
  readonly key = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly hint = input('Puede tardar hasta un minuto.');
  readonly loading = input(false);
  readonly disabled = input(false);
  /** Por qué no se puede generar todavía, si es el caso. */
  readonly blockedReason = input<string | null>(null);
  readonly error = input<string | null>(null);

  readonly generate = output<GenerateRequest>();

  /**
   * El `read` no sobra: la referencia apunta a un `p-button`, y sin él Angular devolvería la
   * instancia del componente en vez del elemento. El tipo genérico no lo evita —es una promesa
   * al compilador, no una lectura— así que el fallo no sale hasta que algo pide `nativeElement`.
   */
  private readonly generateButton = viewChild.required('generateButton', { read: ElementRef });

  readonly instruccion = signal('');
  readonly maxLength = MAX_INSTRUCCION_LENGTH;

  onGenerate(): void {
    this.generate.emit({
      instruccion: this.instruccion().trim(),
      target: this.generateButton().nativeElement,
    });
  }
}
