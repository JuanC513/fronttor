import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LearningLesson } from './learning-lesson';

describe('LearningLesson', () => {
  let component: LearningLesson;
  let fixture: ComponentFixture<LearningLesson>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearningLesson],
    }).compileComponents();

    fixture = TestBed.createComponent(LearningLesson);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
