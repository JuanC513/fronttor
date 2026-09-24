import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';

import { AnswerQuestionRequest } from '../models/answer-question-model';
import { CodeChatContext, LessonChatContext } from '../models/chat-model';
import { AiChatService } from './ai-chat-service';
import { AiService } from './ai-service';

describe('AiChatService', () => {
  let service: AiChatService;
  let answerQuestion: jasmine.Spy;

  const lessonContext: LessonChatContext = {
    key: 'lesson:1',
    tipo: 'leccion',
    saludo: 'Hola',
    placeholder: 'Tu duda…',
    tema: 'CSS',
    subtema: 'Flexbox',
    nombreBloque: 'Ejes',
    contenidoBloque: '# Flexbox',
  };

  /** El código vive en una señal, igual que en el taller: el contexto solo lleva cómo leerla. */
  const codeContext = (code: ReturnType<typeof signal<CodeRunnerState>>): CodeChatContext => ({
    key: 'playground',
    tipo: 'codigo',
    saludo: 'Veo tu código',
    placeholder: 'Tu duda…',
    obtenerCodigo: code,
    obtenerConsola: () => ['TypeError: x is not a function'],
  });

  /** El cuerpo de la última petición. */
  const lastRequest = (): AnswerQuestionRequest => answerQuestion.calls.mostRecent().args[0];

  beforeEach(() => {
    answerQuestion = jasmine.createSpy('answerQuestion').and.resolveTo('Respuesta del tutor');

    TestBed.configureTestingModule({
      providers: [{ provide: AiService, useValue: { answerQuestion } }],
    });

    service = TestBed.inject(AiChatService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('contexto de lección', () => {
    it('manda el contenido del bloque como material de la lección', async () => {
      service.setContext(lessonContext);

      await service.send('¿Qué es flex-grow?');

      expect(lastRequest()).toEqual(
        jasmine.objectContaining({
          modo: 'leccion',
          pregunta: '¿Qué es flex-grow?',
          contenidoLeccion: '# Flexbox',
          tema: 'CSS',
          subtema: 'Flexbox',
          nombreBloque: 'Ejes',
        }),
      );
    });
  });

  describe('contexto de código', () => {
    it('manda el código y la consola del taller', async () => {
      const code = signal<CodeRunnerState>({ html: '<h1>Hola</h1>', css: '', js: '' });
      service.setContext(codeContext(code));

      await service.send('¿Por qué falla?');

      expect(lastRequest()).toEqual(
        jasmine.objectContaining({
          modo: 'codigo',
          pregunta: '¿Por qué falla?',
          codigo: { html: '<h1>Hola</h1>', css: '', js: '' },
          consola: ['TypeError: x is not a function'],
        }),
      );
    });

    /**
     * Lo que justifica que el contexto lleve una función y no el código: la vista lo publica una
     * sola vez, y lo que viaja es lo que hay escrito al pulsar enviar, no lo que había al entrar.
     */
    it('lee el código al enviar, no al publicar el contexto', async () => {
      const code = signal<CodeRunnerState>({ html: '<p>viejo</p>', css: '', js: '' });
      service.setContext(codeContext(code));

      code.set({ html: '<p>nuevo</p>', css: '', js: '' });
      await service.send('¿Y ahora?');

      const request = lastRequest();
      expect(request.modo).toBe('codigo');
      expect(request.modo === 'codigo' && request.codigo.html).toBe('<p>nuevo</p>');
    });
  });

  describe('vida de la conversación', () => {
    it('conserva el historial mientras el key no cambie', async () => {
      service.setContext(lessonContext);
      await service.send('Primera');

      // Cambia el bloque visible, pero sigue siendo el mismo subtema.
      service.setContext({ ...lessonContext, nombreBloque: 'Otro bloque' });
      await service.send('Segunda');

      expect(lastRequest().historial).toEqual([
        { rol: 'estudiante', texto: 'Primera' },
        { rol: 'tutor', texto: 'Respuesta del tutor' },
      ]);
      expect(service.messages().length).toBe(4);
    });

    it('descarta la conversación cuando el key cambia', async () => {
      service.setContext(lessonContext);
      await service.send('Primera');

      service.setContext({ ...lessonContext, key: 'lesson:2' });

      expect(service.messages()).toEqual([]);
    });

    it('clearContext deja el chat indisponible y sin mensajes', async () => {
      service.setContext(lessonContext);
      await service.send('Primera');

      service.clearContext();

      expect(service.context()).toBeNull();
      expect(service.messages()).toEqual([]);
      expect(service.isOpen()).toBeFalse();
    });

    /** Sin contexto publicado no hay a qué responder, así que no se gasta una llamada al modelo. */
    it('no envía nada si no hay contexto', async () => {
      await service.send('¿Hola?');

      expect(answerQuestion).not.toHaveBeenCalled();
    });
  });
});
