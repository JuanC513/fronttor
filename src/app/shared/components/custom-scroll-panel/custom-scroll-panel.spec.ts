import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomScrollPanel } from './custom-scroll-panel';

describe('CustomScrollPanel', () => {
  let component: CustomScrollPanel;
  let fixture: ComponentFixture<CustomScrollPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomScrollPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomScrollPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
