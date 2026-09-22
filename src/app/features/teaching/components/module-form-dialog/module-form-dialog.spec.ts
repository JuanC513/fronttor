import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleFormDialog } from './module-form-dialog';

describe('ModuleFormDialog', () => {
  let component: ModuleFormDialog;
  let fixture: ComponentFixture<ModuleFormDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleFormDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(ModuleFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
