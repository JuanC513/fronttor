import { Component, DestroyRef, inject, input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CriterionType } from '@domain/learning/models/exercise-criterion-model';
import {
  CRITERION_TYPES,
  CriterionTypeMeta,
  metaFor,
} from '@features/admin/utils/criterion-fields';
import { FieldError } from '@shared/components/field-error/field-error';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { buildCriterionRow } from './criterion-row';

/**
 * Editor de la lista de criterios de un ejercicio.
 *
 * Recibe el `FormArray` en lugar de llevar la lista por su cuenta, igual que `PublicationField`
 * recibe su `FormControl`: así el formulario del ejercicio conserva una sola noción de validez y
 * el botón de guardar se inhabilita solo cuando haya un criterio a medias.
 *
 * Es el primer `FormArray` del repositorio. Se justifica porque cada campo necesita su propia
 * validación: un criterio con el selector vacío se guardaría sin protestar y luego no casaría con
 * nada, que es exactamente la clase de error que este editor existe para evitar.
 */
@Component({
  selector: 'app-criterion-editor',
  imports: [
    ButtonModule,
    FieldError,
    FloatLabelModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    SelectModule,
  ],
  templateUrl: './criterion-editor.html',
  styleUrl: './criterion-editor.scss',
})
export class CriterionEditor {
  readonly criteria = input.required<FormArray<FormGroup>>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = CRITERION_TYPES;

  get rows(): FormGroup[] {
    return this.criteria().controls;
  }

  meta(row: FormGroup): CriterionTypeMeta {
    return metaFor(row.controls['type'].value as CriterionType);
  }

  add(): void {
    this.criteria().push(buildCriterionRow(this.formBuilder, this.destroyRef, 'element_exists'));
  }

  remove(index: number): void {
    this.criteria().removeAt(index);
  }

  /**
   * Cambiar el tipo rehace la fila entera en vez de ir añadiendo y quitando controles.
   *
   * Los campos no solo aparecen y desaparecen: el valor pasa de texto a número entre tipos, y
   * arrastrar el control anterior dejaría un «3» de texto donde se espera un 3. Rehacerla es más
   * corto de leer y no deja estados intermedios posibles.
   *
   * Lo único que sobrevive es la descripción, y solo si la escribió el administrador.
   */
  onTypeChange(index: number, row: FormGroup): void {
    const description = row.controls['description'];
    const written = description.dirty ? description.value : '';

    this.criteria().setControl(
      index,
      buildCriterionRow(this.formBuilder, this.destroyRef, row.controls['type'].value, {
        description: written,
      }),
    );
  }
}
