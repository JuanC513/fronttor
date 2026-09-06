import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMain } from './admin-main';

describe('AdminMain', () => {
  let component: AdminMain;
  let fixture: ComponentFixture<AdminMain>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMain],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminMain);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
