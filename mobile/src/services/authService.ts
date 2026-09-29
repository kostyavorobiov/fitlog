import { User } from '../types/workout';
import { MobileStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';

const ACTIVE_USER_KEY = 'mobile_active_user';

export class AuthService {
  /**
   * Get the currently logged in user from storage or Supabase session
   */
  static async getCurrentUser(): Promise<User | null> {
    const cachedUser = await MobileStorage.getItem<User | null>(ACTIVE_USER_KEY, null);
    if (cachedUser) return cachedUser;

    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // Fallback user mapped from auth
        return {
          id: data.user.id,
          profileCode: data.user.id.slice(0, 8).toUpperCase(),
          firstName: data.user.user_metadata?.first_name || '',
          lastName: data.user.user_metadata?.last_name || '',
          name: data.user.user_metadata?.name || data.user.email || 'User',
          email: data.user.email || '',
          image: data.user.user_metadata?.avatar_url || '',
          role: 'athlete',
          createdAt: data.user.created_at,
        };
      }
    }

    return null;
  }

  /**
   * Set active user
   */
  static async setActiveUser(user: User | null): Promise<boolean> {
    if (!user) {
      return MobileStorage.removeItem(ACTIVE_USER_KEY);
    }
    return MobileStorage.setItem(ACTIVE_USER_KEY, user);
  }

  /**
   * Sign out
   */
  static async signOut(): Promise<void> {
    await MobileStorage.removeItem(ACTIVE_USER_KEY);
    if (supabase) {
      await supabase.auth.signOut();
    }
  }
}
