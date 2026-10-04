import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { LessonService } from './lesson-service';

/** Mismo doble que en `block-service.spec`: apunta lo que se encadena y es «thenable». */
function fakeClient() {
  const llamadas: string[] = [];

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: (columna: string, opciones?: { ascending?: boolean }) => {
      llamadas.push(`order:${columna}:${opciones?.ascending}`);
      return builder;
    },
    then: (resolver: (r: { data: unknown[]; error: null }) => void) =>
      resolver({ data: [], error: null }),
  };

  return {
    llamadas,
    client: {
      from: (tabla: string) => {
        llamadas.push(`from:${tabla}`);
        return builder;
      },
    },
  };
}

describe('LessonService', () => {
  let service: LessonService;
  let doble: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    doble = fakeClient();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: doble.client } }],
    });
    service = TestBed.inject(LessonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /** Mismo motivo que en `BlockService`: sin `order by`, el orden lo decide la posición física. */
  it('pide los subtemas ordenados por su posición', async () => {
    await service.getAll();

    expect(doble.llamadas).toContain('from:lessons');
    expect(doble.llamadas).toContain('order:order:true');
  });
});
