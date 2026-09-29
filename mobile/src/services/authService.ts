import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole } from '../types/workout';
import { MobileStorage } from '../lib/storage';

// Dynamically resolve Expo WebBrowser and Linking to support all platforms & test runners
let WebBrowserModule: typeof import('expo-web-browser') | null = null;
let LinkingModule: typeof import('expo-linking') | null = null;

const getWebBrowser = () => {
  if (!WebBrowserModule) {
    try {
      WebBrowserModule = require('expo-web-browser');
      WebBrowserModule?.maybeCompleteAuthSession();
    } catch {}
  }
  return WebBrowserModule;
};

const getLinking = () => {
  if (!LinkingModule) {
    try {
      LinkingModule = require('expo-linking');
    } catch {}
  }
  return LinkingModule;
};

const ACTIVE_USER_KEY = 'mobile_active_user';


// CUID generation matching web app
export const generateCuid = (): string => {
  const ts = Date.now().toString(36);
  const rnd1 = Math.random().toString(36).substring(2, 8);
  const rnd2 = Math.random().toString(36).substring(2, 10);
  return `c${ts}0000${rnd1}${rnd2}`.substring(0, 25);
};

type AuthListener = (user: User | null) => void;
const listeners = new Set<AuthListener>();

export class AuthService {
  private static notifyListeners(user: User | null) {
    listeners.forEach((listener) => {
      try {
        listener(user);
      } catch (e) {
        console.warn('[AuthService.notifyListeners] Error in listener:', e);
      }
    });
  }

  /**
   * Fetch user profile from Supabase profiles table
   */
  static async fetchProfile(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) return null;

    try {
      // 1. Direct table select
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

      // 2. RPC fallback get_profile_by_id
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_profile_by_id', {
          p_user_id: userId,
        });
        if (!rpcErr && rpcData && rpcData.length > 0) {
          const row = rpcData[0];
          return {
            id: row.id,
            profileCode: row.profile_code || row.id.slice(0, 8),
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Користувач',
            email: row.email || '',
            image: row.avatar_url || '',
            role: (row.role as UserRole) || 'athlete',
            coachId: row.coach_id || null,
            createdAt: row.created_at || new Date().toISOString(),
          };
        }
      } catch {}
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
   * Synchronize Supabase auth user with profiles table (matching web logic)
   */
  static async handleSupabaseUser(sbUser: any): Promise<User> {
    const email = sbUser.email || '';
    const isHardcodedAdmin = email.toLowerCase() === 'kvorobiov9@gmail.com';
    const userMeta = sbUser.user_metadata || {};
    const fullName = userMeta.full_name || userMeta.name || email.split('@')[0] || 'Користувач';
    const nameParts = fullName.trim().split(' ');
    const firstName = userMeta.first_name || nameParts[0] || 'Користувач';
    const lastName = userMeta.last_name || nameParts.slice(1).join(' ') || '';
    const avatarUrl = userMeta.avatar_url || userMeta.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;

    let profile = await this.fetchProfile(sbUser.id);

    if (!profile) {
      const cuid = isHardcodedAdmin ? 'cmug5e9xj0000j5d57meirzop' : generateCuid();
      profile = {
        id: sbUser.id,
        profileCode: cuid,
        firstName,
        lastName,
        name: fullName,
        email,
        role: isHardcodedAdmin ? 'admin' : 'athlete',
        image: avatarUrl,
        createdAt: sbUser.created_at || new Date().toISOString(),
      };
      await this.upsertProfile(profile);
    } else if (isHardcodedAdmin && profile.role !== 'admin') {
      profile.role = 'admin';
      await this.upsertProfile(profile);
    }

    await MobileStorage.setItem(ACTIVE_USER_KEY, profile);
    this.notifyListeners(profile);
    return profile;
  }

  /**
   * Get the currently logged in user (with instant local storage retrieval and background sync)
   */
  static async getCurrentUser(): Promise<User | null> {
    // 1. Try Supabase active session first if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await this.handleSupabaseUser(session.user);
          return profile;
        }
      } catch (e) {
        console.warn('[AuthService.getCurrentUser] Error checking Supabase session:', e);
      }
    }

    // 2. Return cached user from local storage
    return MobileStorage.getItem<User | null>(ACTIVE_USER_KEY, null);
  }

  /**
   * Sign in using Google OAuth (Expo WebBrowser + Supabase OAuth)
   */
  static async signInWithGoogle(): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { user: null, error: 'Supabase не налаштовано. Налаштуйте змінні середовища або використайте тестовий вхід.' };
    }

    try {
      const WebBrowser = getWebBrowser();
      const Linking = getLinking();

      if (!WebBrowser || !Linking) {
        return { user: null, error: 'Модулі браузера недоступні для цієї платформи' };
      }

      const redirectUrl = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (!data?.url) {
        return { user: null, error: 'Не вдалося згенерувати посилання для Google авторизації' };
      }

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (res.type === 'success' && res.url) {
        const parsed = Linking.parse(res.url);


        // 1. PKCE Authorization Code flow
        const code = (parsed.queryParams?.code as string) || undefined;
        if (code) {
          const { data: sessionData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            return { user: null, error: exchangeErr.message };
          }
          if (sessionData.user) {
            const user = await this.handleSupabaseUser(sessionData.user);
            return { user };
          }
        }

        // 2. Implicit / Hash token flow
        let accessToken = parsed.queryParams?.access_token as string | undefined;
        let refreshToken = parsed.queryParams?.refresh_token as string | undefined;

        if (!accessToken && res.url.includes('#')) {
          const hash = res.url.split('#')[1];
          const hashParams = new URLSearchParams(hash);
          accessToken = hashParams.get('access_token') || undefined;
          refreshToken = hashParams.get('refresh_token') || undefined;
        }

        if (accessToken && refreshToken) {
          const { data: sessionData, error: setSessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionErr) {
            return { user: null, error: setSessionErr.message };
          }

          if (sessionData.user) {
            const user = await this.handleSupabaseUser(sessionData.user);
            return { user };
          }
        }

        // 3. Fallback check active session
        const active = await this.getCurrentUser();
        return { user: active };
      } else if (res.type === 'cancel' || res.type === 'dismiss') {
        return { user: null, error: 'Авторизацію скасовано' };
      }

      return { user: null, error: 'Помилка завершення сесії Google' };
    } catch (e: any) {
      return { user: null, error: e?.message || 'Помилка Google OAuth' };
    }
  }

  /**
   * Sign in with Email and Password
   */
  static async signInWithEmail(email: string, password: string): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { user: null, error: 'Supabase не налаштовано. Налаштуйте змінні або скористайтеся демо-входом.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const user = await this.handleSupabaseUser(data.user);
        return { user };
      }

      return { user: null, error: 'Користувача не знайдено' };
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
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            name: fullName,
            role,
          },
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const user = await this.handleSupabaseUser(data.user);
        return { user };
      }

      return { user: null, error: 'Не вдалося створити обліковий запис' };
    } catch (e: any) {
      return { user: null, error: e?.message || 'Помилка реєстрації' };
    }
  }

  /**
   * Demo / Test Login (works both offline and with existing database users)
   */
  static async loginAsDemo(
    profileType: 'admin' | 'athlete' | 'coach' = 'admin',
    customUser?: Partial<User>
  ): Promise<{ user: User }> {
    let demoUser: User;

    if (profileType === 'admin') {
      demoUser = {
        id: 'cmug5e9xj0000j5d57meirzop',
        profileCode: 'cmug5e9xj0000j5d57meirzop',
        firstName: 'Костянтин',
        lastName: 'Воробйов',
        name: 'Костянтин Воробйов',
        email: 'kvorobiov9@gmail.com',
        role: 'admin',
        image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Konstantin',
        createdAt: new Date().toISOString(),
        ...customUser,
      };
    } else if (profileType === 'coach') {
      demoUser = {
        id: 'usr_coach_demo',
        profileCode: 'COACH123',
        firstName: 'Тренер',
        lastName: 'FitLog',
        name: 'Тренер FitLog',
        email: 'coach@fitlog.app',
        role: 'coach',
        image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Coach',
        createdAt: new Date().toISOString(),
        ...customUser,
      };
    } else {
      demoUser = {
        id: 'usr_athlete_demo',
        profileCode: 'ATHL456',
        firstName: 'Атлет',
        lastName: 'FitLog',
        name: 'Атлет FitLog',
        email: 'athlete@fitlog.app',
        role: 'athlete',
        image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Athlete',
        createdAt: new Date().toISOString(),
        ...customUser,
      };
    }

    // Attempt to upsert to Supabase if available
    if (isSupabaseConfigured() && supabase) {
      try {
        await this.upsertProfile(demoUser);
      } catch {}
    }

    await MobileStorage.setItem(ACTIVE_USER_KEY, demoUser);
    this.notifyListeners(demoUser);
    return { user: demoUser };
  }

  /**
   * Listen to auth state changes (Supabase session + local state)
   */
  static onAuthStateChange(callback: AuthListener): () => void {
    listeners.add(callback);

    let supabaseUnsubscribe: (() => void) | null = null;
    if (isSupabaseConfigured() && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
          const profile = await this.handleSupabaseUser(session.user);
          callback(profile);
        } else if (event === 'SIGNED_OUT') {
          await MobileStorage.removeItem(ACTIVE_USER_KEY);
          callback(null);
        }
      });
      supabaseUnsubscribe = () => subscription.unsubscribe();
    }

    return () => {
      listeners.delete(callback);
      if (supabaseUnsubscribe) {
        supabaseUnsubscribe();
      }
    };
  }

  /**
   * Sign out (clears both Supabase session and local storage)
   */
  static async signOut(): Promise<void> {
    await MobileStorage.removeItem(ACTIVE_USER_KEY);
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[AuthService.signOut] Error:', err);
      }
    }
    this.notifyListeners(null);
  }
}
