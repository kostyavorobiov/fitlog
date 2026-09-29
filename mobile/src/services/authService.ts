import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole } from '../types/workout';
import { MobileStorage } from '../lib/storage';

const ACTIVE_USER_KEY = 'mobile_active_user';

export class AuthService {
  /**
   * Fetch user profile from Supabase profiles table
   */
  static async fetchProfile(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          profileCode: data.profile_code || data.id.slice(0, 8),
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Користувач',
          email: data.email || '',
          image: data.avatar_url || '',
          role: (data.role as UserRole) || 'athlete',
          coachId: data.coach_id || null,
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('[AuthService.fetchProfile] Error:', e);
    }

    return null;
  }

  /**
   * Upsert user profile into Supabase
   */
  static async upsertProfile(user: User): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          profile_code: user.profileCode,
          email: user.email,
          first_name: user.firstName || '',
          last_name: user.lastName || '',
          name: user.name || '',
          avatar_url: user.image || '',
          role: user.role,
          coach_id: user.coachId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      return !error;
    } catch (e) {
      console.warn('[AuthService.upsertProfile] Error:', e);
      return false;
    }
  }

  /**
   * Get the currently logged in user (from Supabase session with local storage fallback)
   */
  static async getCurrentUser(): Promise<User | null> {
    // 1. Try Supabase session
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await this.fetchProfile(session.user.id);
          if (profile) {
            await MobileStorage.setItem(ACTIVE_USER_KEY, profile);
            return profile;
          }

          // If no profile found in DB yet, create a baseline profile
          const meta = session.user.user_metadata || {};
          const fullName = meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Атлет';
          const nameParts = fullName.trim().split(' ');
          const baseline: User = {
            id: session.user.id,
            profileCode: session.user.id.slice(0, 8).toUpperCase(),
            firstName: meta.first_name || nameParts[0] || 'Атлет',
            lastName: meta.last_name || nameParts.slice(1).join(' ') || '',
            name: fullName,
            email: session.user.email || '',
            image: meta.avatar_url || '',
            role: 'athlete',
            createdAt: session.user.created_at,
          };

          await this.upsertProfile(baseline);
          await MobileStorage.setItem(ACTIVE_USER_KEY, baseline);
          return baseline;
        }
      } catch (e) {
        console.warn('[AuthService.getCurrentUser] Error getting Supabase session:', e);
      }
    }

    // 2. Fallback to cached user
    return MobileStorage.getItem<User | null>(ACTIVE_USER_KEY, null);
  }

  /**
   * Sign in with Email and Password
   */
  static async signInWithEmail(email: string, password: string): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { user: null, error: 'Supabase не налаштовано' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const profile = await this.fetchProfile(data.user.id);
        if (profile) {
          await MobileStorage.setItem(ACTIVE_USER_KEY, profile);
          return { user: profile };
        }
      }

      const active = await this.getCurrentUser();
      return { user: active };
    } catch (e: any) {
      return { user: null, error: e?.message || 'Помилка авторизації' };
    }
  }

  /**
   * Sign up with Email and Password
   */
  static async signUpWithEmail(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole = 'athlete'
  ): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { user: null, error: 'Supabase не налаштовано' };
    }

    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            name: fullName,
            role,
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const newUser: User = {
          id: data.user.id,
          profileCode: data.user.id.slice(0, 8).toUpperCase(),
          firstName,
          lastName,
          name: fullName,
          email,
          image: '',
          role,
          createdAt: new Date().toISOString(),
        };

        await this.upsertProfile(newUser);
        await MobileStorage.setItem(ACTIVE_USER_KEY, newUser);
        return { user: newUser };
      }

      return { user: null, error: 'Користувача не створено' };
    } catch (e: any) {
      return { user: null, error: e?.message || 'Помилка реєстрації' };
    }
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: User | null) => void): () => void {
    if (!isSupabaseConfigured() || !supabase) {
      return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const profile = await this.fetchProfile(session.user.id);
        callback(profile);
      } else if (event === 'SIGNED_OUT') {
        await MobileStorage.removeItem(ACTIVE_USER_KEY);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Sign out
   */
  static async signOut(): Promise<void> {
    await MobileStorage.removeItem(ACTIVE_USER_KEY);
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
  }
}
