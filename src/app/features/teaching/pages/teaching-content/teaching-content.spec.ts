import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeachingContent } from './teaching-content';

describe('TeachingContent', () => {
  let component: TeachingContent;
  let fixture: ComponentFixture<TeachingContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeachingContent],
    }).compileComponents();

    fixture = TestBed.createComponent(TeachingContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
