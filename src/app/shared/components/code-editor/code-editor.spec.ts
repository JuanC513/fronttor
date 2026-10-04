import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeEditor } from './code-editor';

describe('CodeEditor', () => {
  let component: CodeEditor;
  let fixture: ComponentFixture<CodeEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeEditor);
    component = fixture.componentInstance;

    // `value` es un `model.required`, así que hay que darle uno antes del primer ciclo: el efecto
    // que sincroniza el editor lo lee, y sin valor lanza NG0952 en vez de montar el componente.
    fixture.componentRef.setInput('value', { html: '', css: '', js: '' });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
