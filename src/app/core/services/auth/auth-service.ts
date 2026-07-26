import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase-service';
import { BehaviorSubject, map } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { Profile, UserRole } from '@core/interfaces/profile';

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
  isAdmin$ = this.profile$.pipe(map((profile) => profile?.role === 'admin'));

  getCurrentUser() {
    return this.userSubject.value;
  }

  getCurrentProfile() {
    return this.profileSubject.value;
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
        roles(
          name
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

    const profile: Profile = {
      ...data,
      role: data.roles?.name as UserRole,
    };
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
