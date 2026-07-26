import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownModule } from 'ngx-markdown';

import { MarkdownRenderer } from './markdown-renderer';

describe('MarkdownRenderer', () => {
  let component: MarkdownRenderer;
  let fixture: ComponentFixture<MarkdownRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownRenderer],
      providers: [importProvidersFrom(MarkdownModule.forRoot())],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownRenderer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
