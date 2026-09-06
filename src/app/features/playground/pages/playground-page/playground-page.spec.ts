import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaygroundPage } from './playground-page';

describe('PlaygroundPage', () => {
  let component: PlaygroundPage;
  let fixture: ComponentFixture<PlaygroundPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaygroundPage],
    }).compileComponents();

    fixture = TestBed.createComponent(PlaygroundPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
