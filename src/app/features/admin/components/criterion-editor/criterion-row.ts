import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CriterionType, ExerciseCriterion } from '@domain/learning/models/exercise-criterion-model';
import {
  CriterionFormValue,
  metaFor,
  suggestDescription,
} from '@features/admin/utils/criterion-fields';

const MAX_FIELD_LENGTH = 200;

/**
 * Construye la fila de formulario de un criterio.
 *
 * Vive fuera del componente porque hay dos sitios que crean filas: el editor, al añadir una o al
 * cambiarle el tipo, y el formulario del ejercicio, al cargar los criterios que ya estaban
 * guardados. Esa segunda carga ocurre en `ngOnInit`, antes de que exista el editor, así que no
 * podía resolverse llamándole a él.
 *
 * @param destroyRef El de quien crea la fila, para el relleno automático de la descripción.
 */
export function buildCriterionRow(
  formBuilder: FormBuilder,
  destroyRef: DestroyRef,
  type: CriterionType,
  criterion?: Partial<ExerciseCriterion>,
): FormGroup {
  const meta = metaFor(type);
  const raw = (criterion ?? {}) as Record<string, unknown>;

  const row = formBuilder.group({
    type: [type],
    description: [
      (raw['description'] as string) ?? '',
      [Validators.required, Validators.maxLength(MAX_FIELD_LENGTH)],
    ],
  }) as FormGroup;

  const text = (initial: unknown) =>
    formBuilder.control((initial as string) ?? '', [
      Validators.required,
      Validators.maxLength(MAX_FIELD_LENGTH),
    ]);

  if (meta.selector) row.addControl('selector', text(raw['selector']));
  if (meta.attribute) row.addControl('attribute', text(raw['attribute']));
  if (meta.property) row.addControl('property', text(raw['property']));

  if (meta.value === 'text') row.addControl('value', text(raw['value']));
  if (meta.value === 'number') {
    row.addControl(
      'value',
      formBuilder.control((raw['value'] as number) ?? 1, [Validators.required]),
    );
  }

  // Una descripcion que ya venia escrita se marca como tocada, o el relleno automatico la pisaria.
  if (row.controls['description'].value) row.controls['description'].markAsDirty();

  autoDescribe(row, destroyRef);
  return row;
}

/**
 * Rellena la descripción mientras siga sin tocar.
 *
 * `pristine` ya lleva ese estado, no hace falta inventar otro: en cuanto el administrador escribe
 * algo suyo, el control queda sucio y aquí se deja de escribir.
 *
 * `emitEvent: false` es lo que corta el ciclo, porque escribir la descripción vuelve a disparar los
 * cambios de la fila.
 */
function autoDescribe(row: FormGroup, destroyRef: DestroyRef): void {
  row.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((raw) => {
    const description = row.controls['description'];
    if (!description.pristine) return;

    description.setValue(suggestDescription(raw as CriterionFormValue), { emitEvent: false });
  });
}
