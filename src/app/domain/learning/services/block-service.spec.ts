import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';

import { BlockService } from './block-service';

/**
 * Doble del constructor de consultas de supabase-js que apunta qué se le encadenó.
 *
 * Se hace «thenable» porque el servicio hace `await` sobre la propia cadena, no sobre un `.then`
 * explícito: sin esto la espera no resolvería nunca.
 */
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

describe('BlockService', () => {
  let service: BlockService;
  let doble: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    doble = fakeClient();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: doble.client } }],
    });
    service = TestBed.inject(BlockService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Regresión: `getAll` no ordenaba. Quien la consume filtra por subtema en el cliente y numera por
   * la posición en el array, así que al devolver PostgREST las filas en su orden físico —que cambia
   * al actualizar cualquiera— editar un bloque lo movía de sitio en la lista.
   */
  it('pide los bloques ordenados por su posición', async () => {
    await service.getAll();

    expect(doble.llamadas).toContain('from:blocks');
    expect(doble.llamadas).toContain('order:order:true');
  });
});
