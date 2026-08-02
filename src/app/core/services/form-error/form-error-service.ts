import { Injectable } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

/**
 * Traduce los `ValidationErrors` de un `AbstractControl` a un mensaje en español.
 *
 * Centraliza el texto de los validadores estándar de Angular (`required`, `email`, etc.) para que
 * los formularios no repitan el mismo texto en cada plantilla. Para errores propios de un campo
 * puntual, `FieldError` acepta `customMessages` y esos tienen prioridad sobre este servicio.
 */
@Injectable({
  providedIn: 'root',
})
export class FormErrorService {
  getErrorMessage(errors: ValidationErrors | null): string | null {
    if (!errors) return null;

    // El orden importa: se muestra el primer error encontrado.
    if (errors['required']) return 'Este campo es obligatorio.';

    if (errors['email']) return 'Ingresa un correo electrónico válido.';

    if (errors['pattern']) return 'El formato ingresado no es válido.';

    if (errors['min']) {
      const { min } = errors['min'];
      return `Ingresa un valor mayor o igual a ${min}.`;
    }

    if (errors['max']) {
      const { max } = errors['max'];
      return `Ingresa un valor menor o igual a ${max}.`;
    }

    if (errors['minlength']) {
      const { requiredLength } = errors['minlength'];
      return `Debe tener al menos ${requiredLength} caracteres.`;
    }

    if (errors['maxlength']) {
      const { requiredLength } = errors['maxlength'];
      return `Debe tener máximo ${requiredLength} caracteres.`;
    }

    return 'Campo inválido.'; // fallback genérico
  }
}
