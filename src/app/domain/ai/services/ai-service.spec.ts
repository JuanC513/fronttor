import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { GenerateFeedbackRequest } from '../models/generate-feedback-model';
import { AiService } from './ai-service';

describe('AiService', () => {
  let service: AiService;
  let invoke: jasmine.Spy;

  const request: GenerateFeedbackRequest = {
    enunciado: 'Escribe un título',
    html: '<p>hola</p>',
    css: '',
    js: '',
    criterios: [{ description: 'Existe un h1', passed: false }],
    exerciseId: 7,
  };

  const setup = (result: { data?: unknown; error?: Error | null }) => {
    invoke = jasmine.createSpy('invoke').and.resolveTo({
      data: result.data ?? null,
      error: result.error ?? null,
    });

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { functions: { invoke } } } }],
    });

    service = TestBed.inject(AiService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should be created', () => {
    setup({ data: { feedback: { criterio: 1, pista: 'Prueba' } } });
    expect(service).toBeTruthy();
  });

  describe('generateFeedback', () => {
    it('llama a la función con el cuerpo y devuelve la pista desenvuelta', async () => {
      setup({ data: { feedback: { criterio: 1, pista: 'Te falta el h1.' } } });

      const hint = await service.generateFeedback(request);

      expect(invoke).toHaveBeenCalledWith('generate-feedback', {
        body: request,
        signal: undefined,
      });
      expect(hint).toEqual({ criterio: 1, pista: 'Te falta el h1.' });
    });

    it('pasa la señal de cancelación', async () => {
      setup({ data: { feedback: { criterio: 0, pista: 'Prueba' } } });
      const signal = new AbortController().signal;

      await service.generateFeedback(request, signal);

      expect(invoke.calls.mostRecent().args[1].signal).toBe(signal);
    });

    /**
     * El caso que justifica `readFunctionError`: `functions.invoke` no expone el cuerpo de una
     * respuesta no-2xx, y su `message` es siempre el mismo texto genérico. El mensaje que de verdad
     * importa —«El modelo está saturado», «Requiere rol de profesor»— viaja dentro de
     * `error.context`, que es un `Response` sin leer.
     */
    it('saca el mensaje real de la función en vez del genérico de invoke', async () => {
      const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: new Response(JSON.stringify({ error: 'El modelo está saturado.' }), {
          status: 503,
        }),
      });
      setup({ error });

      await expectAsync(service.generateFeedback(request)).toBeRejectedWithError(
        'El modelo está saturado.',
      );
    });

    it('se queda con el mensaje genérico si el cuerpo no es JSON', async () => {
      const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: new Response('<html>502</html>', { status: 502 }),
      });
      setup({ error });

      await expectAsync(service.generateFeedback(request)).toBeRejectedWithError(
        'Edge Function returned a non-2xx status code',
      );
    });

    /** Una respuesta sin cuerpo no debe reventar la vista: se degrada a una pista vacía. */
    it('tolera una respuesta sin datos', async () => {
      setup({ data: null });

      expect(await service.generateFeedback(request)).toEqual({ pista: '' });
    });
  });
});
