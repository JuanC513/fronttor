import { TestBed } from '@angular/core/testing';

import { FormErrorService } from './form-error-service';

describe('FormErrorService', () => {
  let service: FormErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FormErrorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when there are no errors', () => {
    expect(service.getErrorMessage(null)).toBeNull();
  });

  it('should return a message for a required error', () => {
    expect(service.getErrorMessage({ required: true })).toBe('Este campo es obligatorio.');
  });

  it('should return a message for an email error', () => {
    expect(service.getErrorMessage({ email: true })).toBe('Ingresa un correo electrónico válido.');
  });

  it('should interpolate the required length for minlength', () => {
    expect(service.getErrorMessage({ minlength: { requiredLength: 8 } })).toBe(
      'Debe tener al menos 8 caracteres.',
    );
  });

  it('should fall back to a generic message for unknown errors', () => {
    expect(service.getErrorMessage({ someUnknownError: true })).toBe('Campo inválido.');
  });
});
