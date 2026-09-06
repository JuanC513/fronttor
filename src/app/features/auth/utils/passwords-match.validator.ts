import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador a nivel de grupo: comprueba que dos controles de contraseña coincidan.
 *
 * Va en el grupo y no en el control de confirmación porque necesita leer ambos valores; el error
 * (`passwordsMismatch`) queda en el `FormGroup`, así que la plantilla lo consulta con
 * `form.hasError('passwordsMismatch')`.
 */
export function passwordsMatch(passwordKey: string, confirmPasswordKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirmPassword = group.get(confirmPasswordKey)?.value;

    // Mientras la confirmación esté vacía no se marca error: de eso ya se encarga `required`, y
    // así no aparece "no coinciden" en cuanto el usuario escribe la primera letra.
    if (!confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordsMismatch: true };
  };
}
