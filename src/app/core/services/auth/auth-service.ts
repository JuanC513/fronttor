import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase-service';
import { BehaviorSubject, map } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { Profile, UserRole } from '@core/interfaces/profile';

/** Forma cruda del embed `user_roles(roles(name))` tal y como llega de PostgREST. */
type RolesEmbed = { roles?: { name?: string } | { name?: string }[] | null }[] | null | undefined;

/**
 * Traduce el embed anidado a la lista de nombres de rol.
 *
 * Tolera que el nivel interno venga como objeto o como array: la cardinalidad que infiere
 * supabase-js para una relación embebida no es estable, y es el mismo cuidado que ya tiene
 * `requireTeacher` en las Edge Functions. Importa más de lo que parece porque el cliente no está
 * tipado con un `Database` generado —todo lo que devuelve es `any`—, así que un cambio de forma no
 * daría error de compilación: se manifestaría como un usuario sin roles y sin nada en la consola.
 *
 * Un perfil sin filas en `user_roles` devuelve una lista vacía, que los guards tratan como sin
 * acceso. Es la respuesta segura ante un embed que no llegó.
 */
function readRoles(embed: RolesEmbed): UserRole[] {
  return (embed ?? [])
    .map((row) => (Array.isArray(row.roles) ? row.roles[0]?.name : row.roles?.name))
    .filter((name): name is string => !!name) as UserRole[];
}

/**
 * Estado global de sesión y perfil.
 *
 * Es la excepción a la convención del repo: los demás servicios de dominio publican cambios con
 * una señal `refreshTrigger`, y este usa `BehaviorSubject` más observables. El motivo es que la
 * sesión no se consulta, se **escucha**: `onAuthStateChange` puede dispararla en cualquier momento
 * —al renovarse el token, al volver de Google, al cerrar sesión en otra pestaña— y los guards
 * necesitan un flujo al que suscribirse, no un valor que preguntar.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  /** Envoltorio del cliente, inyectado para poder sustituirlo en pruebas. */
  private readonly supabaseService = inject(SupabaseService);
  /** Fuente de `user$`. Privada para que solo este servicio decida cuándo cambia la sesión. */
  private userSubject = new BehaviorSubject<User | null>(null);
  /** Fuente de `profile$`. */
  private profileSubject = new BehaviorSubject<Profile | null>(null);
  /** Fuente de `initialized$`. Pasa a `true` una sola vez, al resolver la sesión inicial. */
  private initializedSubject = new BehaviorSubject<boolean>(false);

  /** El usuario de Supabase con sesión abierta, o `null`. */
  user$ = this.userSubject.asObservable();

  /** Su fila de `profiles` con los roles resueltos, o `null` mientras no haya sesión. */
  profile$ = this.profileSubject.asObservable();

  /**
   * Si ya se resolvió la primera lectura de sesión.
   *
   * Los guards tienen que esperar a esto: antes del primer `getUser`, `user$` vale `null` porque
   * todavía no se sabe, no porque no haya sesión. Sin esta señal, una recarga directa sobre una
   * ruta protegida rebotaría al login aunque la sesión fuera válida.
   */
  initialized$ = this.initializedSubject.asObservable();

  /** Si hay sesión, sin importar de quién. */
  isAuthenticated$ = this.user$.pipe(map((user) => !!user));

  /** Si el usuario tiene rol de profesor. Lo usa `roleGuard` en la rama de `teaching`. */
  isTeacher$ = this.hasRole$('teacher');

  /** Si el usuario tiene rol de estudiante. */
  isStudent$ = this.hasRole$('student');

  /**
   * Si el usuario tiene concedido un rol concreto.
   *
   * Desde que un usuario puede tener varios, preguntar por uno deja de ser una comparación y pasa
   * a ser una búsqueda. Tenerlo aquí evita que cada consumidor repita el `includes` y decida por su
   * cuenta qué hacer cuando todavía no hay perfil cargado.
   */
  hasRole$(role: UserRole) {
    return this.profile$.pipe(map((profile) => profile?.roles.includes(role) ?? false));
  }

  /**
   * El usuario actual, leído de una vez en lugar de suscribiéndose.
   *
   * Para algo que se consulta una vez y no se vuelve a mirar. Lo que se pinta en pantalla debería
   * usar `user$`, que sí reacciona cuando la sesión cambia.
   */
  getCurrentUser() {
    return this.userSubject.value;
  }

  /** El perfil actual, leído de una vez. Mismo criterio que {@link AuthService.getCurrentUser}. */
  getCurrentProfile() {
    return this.profileSubject.value;
  }

  /**
   * Vuelve a leer el perfil de la base y lo publica.
   *
   * Existe para quien lo edita: al guardar la descripción, `profile$` se quedaría con el texto
   * anterior hasta el siguiente arranque de sesión, y la vista mostraría lo viejo justo después de
   * haber escrito lo nuevo. No hace nada si no hay sesión.
   */
  async refreshProfile(): Promise<void> {
    const user = this.userSubject.value;
    if (!user) return;

    await this.loadProfile(user.id);
  }

  /** Arranca la resolución de sesión en cuanto el servicio se instancia. */
  constructor() {
    this.initializeAuth();
  }

  /**
   * Resuelve la sesión inicial y deja enganchado el oyente de cambios.
   *
   * Corre una sola vez, desde el constructor. El `onAuthStateChange` se registra **después** de la
   * primera lectura, no antes: así `initialized$` marca el final de un estado conocido y no se
   * mezcla con los avisos que llegan luego.
   */
  private async initializeAuth() {
    const { data } = await this.supabaseService.client.auth.getUser();

    const user = data.user ?? null;

    this.userSubject.next(user);

    if (user) {
      await this.loadProfile(user.id);
    }

    this.initializedSubject.next(true);

    this.supabaseService.client.auth.onAuthStateChange(async (_, session) => {
      const user = session?.user ?? null;

      this.userSubject.next(user);

      if (user) {
        await this.loadProfile(user.id);
      } else {
        this.profileSubject.next(null);
      }
    });
  }

  /**
   * Lee el perfil con sus roles embebidos y lo publica en `profile$`.
   *
   * Nunca lanza: un fallo aquí deja el perfil en `null` y lo registra en consola. Lo contrario
   * rompería el arranque de la aplicación por no poder leer una descripción.
   */
  private async loadProfile(userId: string) {
    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select(
        `*,
        user_roles(
          roles(
            name
          )
        )
        `,
      )
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error loading profile', error);
      // Se limpia el perfil en vez de dejar el anterior: si no, al cambiar de usuario (o si el
      // trigger que crea la fila en `profiles` falló) quedaría un rol obsoleto que los guards
      // darían por bueno.
      this.profileSubject.next(null);
      return;
    }

    const { user_roles, ...columns } = data;
    const profile: Profile = { ...columns, roles: readRoles(user_roles) };

    this.profileSubject.next(profile);
  }

  /**
   * Crea una cuenta con correo y contraseña.
   *
   * El `emailRedirectTo` solo importa si la confirmación por correo está activada en el panel de
   * Supabase. Con ella desactivada, el registro devuelve sesión directamente y nadie pasa por ahí.
   *
   * @throws El error de Supabase, para que el formulario lo traduzca a un mensaje.
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabaseService.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;

    return data;
  }

  /**
   * Inicia sesión con correo y contraseña.
   *
   * @throws El error de Supabase. Conviene no detallarlo en pantalla: distinguir «no existe» de
   * «contraseña incorrecta» le dice a cualquiera qué correos están registrados.
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return data;
  }

  /**
   * Redirige al consentimiento de Google. La promesa resuelve al iniciar la redirección, no al
   * completarla: la sesión se establece de vuelta en `/auth/callback`.
   */
  async signInWithGoogle() {
    const { error } = await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
  }

  /**
   * Envía el correo para restablecer la contraseña.
   *
   * El dominio de `redirectTo` tiene que estar autorizado en las redirect URLs de Supabase Auth;
   * si no, el enlace del correo no vuelve a la aplicación.
   *
   * No distingue si el correo existe, y es deliberado: así no se puede usar para averiguar quién
   * tiene cuenta.
   */
  async sendPasswordReset(email: string) {
    const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
  }

  /**
   * Cambia la contraseña del usuario con sesión abierta.
   *
   * Supabase no pide la anterior: basta con tener sesión. Por eso el formulario del perfil sí la
   * pide y la verifica antes de llamar aquí, para que una sesión olvidada abierta no permita
   * dejar al dueño fuera de su propia cuenta.
   */
  async updatePassword(newPassword: string) {
    const { error } = await this.supabaseService.client.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  /**
   * Cierra la sesión.
   *
   * No hace falta limpiar `user$` ni `profile$` a mano: `onAuthStateChange` se dispara y de eso
   * se encarga `initializeAuth`.
   */
  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();

    if (error) throw error;
  }
}
