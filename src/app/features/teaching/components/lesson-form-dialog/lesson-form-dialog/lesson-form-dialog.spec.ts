import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LessonFormDialog } from './lesson-form-dialog';

describe('LessonFormDialog', () => {
  let component: LessonFormDialog;
  let fixture: ComponentFixture<LessonFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonFormDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
