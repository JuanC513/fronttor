import { TestBed } from '@angular/core/testing';

import { CodeRunnerStateService } from './code-runner-state-service';

describe('CodeRunnerStateService', () => {
  let service: CodeRunnerStateService;

  beforeEach(() => {
    // El servicio no lleva `providedIn`: se provee por componente para que cada vista con editor
    // tenga su propio estado. Aquí hay que darlo a mano por la misma razón.
    TestBed.configureTestingModule({ providers: [CodeRunnerStateService] });
    service = TestBed.inject(CodeRunnerStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
