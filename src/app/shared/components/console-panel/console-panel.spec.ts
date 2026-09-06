import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsolePanel } from './console-panel';

describe('ConsolePanel', () => {
  let component: ConsolePanel;
  let fixture: ComponentFixture<ConsolePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsolePanel],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsolePanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
