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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private userSubject = new BehaviorSubject<User | null>(null);
  private profileSubject = new BehaviorSubject<Profile | null>(null);
  private initializedSubject = new BehaviorSubject<boolean>(false);
  user$ = this.userSubject.asObservable();
  profile$ = this.profileSubject.asObservable();
  initialized$ = this.initializedSubject.asObservable();
  isAuthenticated$ = this.user$.pipe(map((user) => !!user));
  isTeacher$ = this.hasRole$('teacher');
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

  getCurrentUser() {
    return this.userSubject.value;
  }

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

  constructor() {
    this.initializeAuth();
  }

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

  async sendPasswordReset(email: string) {
    const { error } = await this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
  }

  async updatePassword(newPassword: string) {
    const { error } = await this.supabaseService.client.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();

    if (error) throw error;
  }
}
