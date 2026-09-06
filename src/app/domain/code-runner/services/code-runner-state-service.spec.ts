import { TestBed } from '@angular/core/testing';

import { CodeRunnerStateService } from './code-runner-state-service';

describe('CodeRunnerStateService', () => {
  let service: CodeRunnerStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CodeRunnerStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
