import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase-service';
import { BehaviorSubject, map } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { Profile } from '@core/interfaces/profile';

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
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error loading profile', error);
      return;
    }

    this.profileSubject.next(data);
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.supabaseService.client.auth.signUp({
      email,
      password,
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

  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();

    if (error) throw error;
  }
}
