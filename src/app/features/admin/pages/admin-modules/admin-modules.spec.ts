import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminModules } from './admin-modules';

describe('AdminModules', () => {
  let component: AdminModules;
  let fixture: ComponentFixture<AdminModules>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminModules],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminModules);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
