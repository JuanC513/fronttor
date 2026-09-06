import { ChangeDetectorRef, Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, StatusChangeEvent, TouchedChangeEvent } from '@angular/forms';
import { filter, Subscription } from 'rxjs';
import { FormErrorService } from '@core/services/form-error/form-error-service';

@Component({
  selector: 'app-field-error',
  imports: [],
  templateUrl: './field-error.html',
  styleUrl: './field-error.scss',
})
export class FieldError implements OnInit, OnDestroy {
  @Input({ required: true }) control!: AbstractControl | null;

  /**
   * Mensaje personalizado que sobreescribe el del servicio para un error específico.
   * Ej: [customMessages]="{ pattern: 'Formato: XX.X (ej: 1.1, 12.6)' }"
   */
  @Input() customMessages: Record<string, string> = {};

  errorMessage: string | null = null;
  private sub?: Subscription;
  private readonly errorService = inject(FormErrorService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    if (!this.control) return;

    this.sub = this.control.events
      .pipe(filter((e) => e instanceof TouchedChangeEvent || e instanceof StatusChangeEvent))
      .subscribe(() => {
        this.updateMessage();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private updateMessage() {
    if (!this.control?.touched) {
      this.errorMessage = null;
      return;
    }

    const errors = this.control.errors;
    if (!errors) {
      this.errorMessage = null;
      return;
    }

    // Los customMessages tienen prioridad.
    for (const key of Object.keys(errors)) {
      if (this.customMessages[key]) {
        this.errorMessage = this.customMessages[key];
        return;
      }
    }

    this.errorMessage = this.errorService.getErrorMessage(errors);
  }
}
