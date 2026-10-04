import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { NotificationService } from './notification-service';

describe('NotificationService', () => {
  let service: NotificationService;
  let add: jasmine.Spy;

  beforeEach(() => {
    add = jasmine.createSpy('add');
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: { add } }],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('emite el éxito en verde y con el mensaje dado', () => {
    service.exito('Tema creado');

    expect(add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'success', summary: 'Tema creado' }),
    );
  });

  it('emite el error en rojo y lleva el detalle crudo debajo', () => {
    service.error('No se pudo guardar el tema', 'duplicate key value');

    expect(add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'error',
        summary: 'No se pudo guardar el tema',
        detail: 'duplicate key value',
      }),
    );
  });

  /** Un fallo hay que leerlo; un «listo» se asimila de un vistazo. */
  it('deja el error en pantalla más tiempo que el éxito', () => {
    service.exito('Orden guardado');
    service.error('No se pudo guardar el orden');

    const [exito] = add.calls.argsFor(0) as [{ life: number }];
    const [error] = add.calls.argsFor(1) as [{ life: number }];

    expect(error.life).toBeGreaterThan(exito.life);
  });
});
