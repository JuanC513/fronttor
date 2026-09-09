import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CodeRunnerStateService } from '@domain/code-runner/services/code-runner-state-service';

import { ConsolePanel } from './console-panel';

describe('ConsolePanel', () => {
  let component: ConsolePanel;
  let fixture: ComponentFixture<ConsolePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsolePanel],
      // No es `providedIn: 'root'`: cada ejecutor de codigo tiene su propia instancia.
      providers: [CodeRunnerStateService],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsolePanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
