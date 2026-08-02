import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';

import { FieldError } from './field-error';

describe('FieldError', () => {
  let component: FieldError;
  let fixture: ComponentFixture<FieldError>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldError],
    }).compileComponents();

    fixture = TestBed.createComponent(FieldError);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    component.control = new FormControl('');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should show nothing while the control is untouched', () => {
    const control = new FormControl('', Validators.required);
    component.control = control;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('small')).toBeNull();
  });

  it('should show the service message once the control is touched and invalid', () => {
    const control = new FormControl('', Validators.required);
    component.control = control;
    fixture.detectChanges();

    control.markAsTouched();
    fixture.detectChanges();

    const small = fixture.nativeElement.querySelector('small');
    expect(small?.textContent).toContain('Este campo es obligatorio.');
  });

  it('should prefer a custom message over the service default', () => {
    const control = new FormControl('', Validators.required);
    component.control = control;
    component.customMessages = { required: 'Ingresa tu correo electrónico.' };
    fixture.detectChanges();

    control.markAsTouched();
    fixture.detectChanges();

    const small = fixture.nativeElement.querySelector('small');
    expect(small?.textContent).toContain('Ingresa tu correo electrónico.');
  });
});
