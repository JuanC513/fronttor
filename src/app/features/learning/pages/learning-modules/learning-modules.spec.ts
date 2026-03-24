import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LearningModules } from './learning-modules';

describe('LearningModules', () => {
  let component: LearningModules;
  let fixture: ComponentFixture<LearningModules>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearningModules],
    }).compileComponents();

    fixture = TestBed.createComponent(LearningModules);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
