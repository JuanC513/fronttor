import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { filter, firstValueFrom, take } from 'rxjs';

import { AuthService } from './auth-service';

/**
 * Estas pruebas cubren un punto concreto: la traducción del embed `user_roles(roles(name))` a la
 * lista de roles del perfil.
 *
 * Es el único sitio donde el paso a varios roles puede romperse sin que nadie se entere. El cliente
 * de Supabase no está tipado con un `Database` generado, así que todo lo que devuelve es `any`: si
 * la forma de la respuesta cambiara —porque PostgREST decida devolver un objeto donde antes había
 * un array, o porque el embed no llegue— TypeScript no diría nada y el síntoma sería un usuario sin
 * roles, sin panel y sin una sola línea en la consola.
 */
describe('AuthService', () => {
  const profileRow = (user_roles: unknown) => ({
    user_id: 'usuario-1',
    email: 'alguien@ejemplo.com',
    profile_description: null,
    user_roles,
  });

  /** Cliente mínimo: solo lo que `initializeAuth` y `loadProfile` llegan a tocar. */
  const buildService = async (response: { data?: unknown; error?: unknown }) => {
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'usuario-1' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: null, ...response }) }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client } }],
    });

    const service = TestBed.inject(AuthService);

    // `initialized$` solo emite `true` cuando el perfil ya se cargó, así que esperarlo basta para
    // que `profile$` tenga su valor definitivo.
    await firstValueFrom(service.initialized$.pipe(filter(Boolean), take(1)));

    return service;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('lee todos los roles concedidos', async () => {
    const service = await buildService({
      data: profileRow([{ roles: { name: 'student' } }, { roles: { name: 'admin' } }]),
    });

    expect(service.getCurrentProfile()?.roles).toEqual(['student', 'admin']);
    expect(await firstValueFrom(service.isAdmin$)).toBeTrue();
    expect(await firstValueFrom(service.isStudent$)).toBeTrue();
  });

  it('tolera que el rol venga envuelto en un array', async () => {
    // supabase-js infiere la cardinalidad de una relación embebida, y no siempre la misma.
    const service = await buildService({ data: profileRow([{ roles: [{ name: 'admin' }] }]) });

    expect(service.getCurrentProfile()?.roles).toEqual(['admin']);
  });

  it('un perfil sin roles no es nadie, en vez de romper', async () => {
    const service = await buildService({ data: profileRow([]) });

    expect(service.getCurrentProfile()?.roles).toEqual([]);
    expect(await firstValueFrom(service.isAdmin$)).toBeFalse();
    expect(await firstValueFrom(service.isStudent$)).toBeFalse();
  });

  it('descarta el perfil entero si la consulta falla', async () => {
    // Dejar el perfil anterior sería dejar un rol obsoleto que los guards darían por bueno.
    const service = await buildService({ error: { message: 'boom' } });

    expect(service.getCurrentProfile()).toBeNull();
    expect(await firstValueFrom(service.isAdmin$)).toBeFalse();
  });
});
