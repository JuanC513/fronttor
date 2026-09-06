import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Seguridad de las Edge Functions en dos capas:
 *
 *   Capa 1 — autenticación  (`requireUser`):  quien llama es un usuario real con sesión.
 *   Capa 2 — autorización   (`requireAdmin`): además, ese usuario tiene rol admin.
 *
 * Por qué la verificación vive aquí y no se delega a `verify_jwt`:
 * el chequeo de plataforma solo comprueba que EXISTA un header de autorización, no que
 * contenga un usuario válido. Se verificó empíricamente que la publishable key del proyecto
 * (`sb_publishable_...`, que no es un JWT) pasa ese filtro tanto en `Authorization` como en
 * `apikey`; solo una petición sin ningún header recibe 401 de la plataforma. Como esa key va
 * pública en el bundle de Angular, `verify_jwt` no sirve para distinguir a un usuario de un
 * anónimo. `auth.getUser()` sí: una key sin usuario detrás no produce sesión.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// Supabase inyecta estas variables automáticamente. Se contempla el nombre nuevo por la
// migración en curso al formato `sb_publishable_...`.
const SUPABASE_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AuthenticatedUser {
  id: string;
  /** Cliente ya scoped al usuario: respeta RLS y sirve para consultas posteriores. */
  client: SupabaseClient;
}

/** Capa 1: exige un usuario real con sesión iniciada. */
export async function requireUser(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('No autenticado', 401);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new AuthError('Configuración de Supabase incompleta en la función', 500);
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();

  // Aquí muere una llamada anónima: la publishable key no resuelve a ningún usuario.
  if (error || !data.user) {
    throw new AuthError('No autenticado', 401);
  }

  return { id: data.user.id, client };
}

/** Capa 2: exige además rol admin. */
export async function requireAdmin(req: Request): Promise<AuthenticatedUser> {
  const user = await requireUser(req);

  // Mismo join que usa `AuthService.loadProfile()` en el frontend, para que el criterio
  // de rol sea uno solo en todo el sistema.
  const { data, error } = await user.client
    .from('profiles')
    .select('roles(name)')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new AuthError('No se pudo verificar el rol del usuario', 403);
  }

  // La cardinalidad de la relación embebida varía según cómo la infiera supabase-js.
  const roles = (data as { roles?: { name?: string } | { name?: string }[] | null }).roles;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;

  if (roleName !== 'admin') {
    throw new AuthError('Requiere rol de administrador', 403);
  }

  return user;
}
