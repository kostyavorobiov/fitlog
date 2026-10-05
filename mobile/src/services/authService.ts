import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole } from '../types/workout';
import { MobileStorage } from '../lib/storage';

// Dynamically resolve Expo modules to support all platforms & test runners
let WebBrowserModule: typeof import('expo-web-browser') | null = null;
let LinkingModule: typeof import('expo-linking') | null = null;
let makeRedirectUriFn: typeof import('expo-auth-session').makeRedirectUri | null = null;

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

const getMakeRedirectUri = () => {
  if (!makeRedirectUriFn) {
    try {
      const authSession = require('expo-auth-session');
      makeRedirectUriFn = authSession.makeRedirectUri;
    } catch {}
  }
  return makeRedirectUriFn;
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
   * Update active user profile fields and persist to cache and Supabase
   */
  static async updateUserProfile(updates: Partial<User>): Promise<User | null> {
    const current = await this.getCurrentUser();
    if (!current) return null;

    const firstName = updates.firstName !== undefined ? updates.firstName : current.firstName;
    const lastName = updates.lastName !== undefined ? updates.lastName : current.lastName;
    const name = `${firstName || ''} ${lastName || ''}`.trim() || updates.name || current.name;

    const updated: User = {
      ...current,
      ...updates,
      firstName,
      lastName,
      name,
    };

    if (isSupabaseConfigured() && !await this.upsertProfile(updated)) return null;
    await MobileStorage.setItem(ACTIVE_USER_KEY, updated);
    this.notifyListeners(updated);
    return updated;
  }

  /**
   * Synchronize Supabase auth user with profiles table (matching web logic)
   */
  static async handleSupabaseUser(sbUser: any): Promise<User> {
    const email = sbUser.email || '';
    const userMeta = sbUser.user_metadata || {};
    const fullName = userMeta.full_name || userMeta.name || email.split('@')[0] || 'Користувач';
    const nameParts = fullName.trim().split(' ');
    const firstName = userMeta.first_name || nameParts[0] || 'Користувач';
    const lastName = userMeta.last_name || nameParts.slice(1).join(' ') || '';
    const avatarUrl = userMeta.avatar_url || userMeta.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;

    let profile = await this.fetchProfile(sbUser.id);

    if (!profile) {
      const cuid = generateCuid();
      profile = {
        id: sbUser.id,
        profileCode: cuid,
        firstName,
        lastName,
        name: fullName,
        email,
        role: 'athlete',
        image: avatarUrl,
        createdAt: sbUser.created_at || new Date().toISOString(),
      };
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

  private static processedCodes = new Set<string>();

  /**
   * Handle incoming auth callback URL or parameters (from WebBrowser or Deep Link)
   */
  static async handleAuthCallbackUrl(
    input: string | Record<string, any> | null | undefined
  ): Promise<{ user: User | null; error?: string }> {
    if (!input) {
      const active = await this.getCurrentUser();
      return { user: active };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { user: null, error: 'Supabase не налаштовано' };
    }

    try {
      const Linking = getLinking();
      let code: string | undefined;
      let accessToken: string | undefined;
      let refreshToken: string | undefined;
      let errorDesc: string | undefined;

      if (typeof input === 'string') {
        const rawUrl = input;
        const parsed = Linking?.parse ? Linking.parse(rawUrl) : null;

        // Extract query parameters
        code = (parsed?.queryParams?.code as string) || undefined;
        errorDesc =
          (parsed?.queryParams?.error_description as string) ||
          (parsed?.queryParams?.error as string) ||
          undefined;

        // Extract hash fragments (#access_token=...&refresh_token=...)
        if (rawUrl.includes('#')) {
          const hash = rawUrl.split('#')[1];
          const hashParams = new URLSearchParams(hash);
          accessToken = hashParams.get('access_token') || undefined;
          refreshToken = hashParams.get('refresh_token') || undefined;
          if (!errorDesc) {
            errorDesc = hashParams.get('error_description') || hashParams.get('error') || undefined;
          }
        }

        // If queryParams didn't catch code, extract via URLSearchParams
        if (!code && rawUrl.includes('?')) {
          const queryPart = rawUrl.split('?')[1].split('#')[0];
          const queryParams = new URLSearchParams(queryPart);
          code = queryParams.get('code') || undefined;
          if (!errorDesc) {
            errorDesc = queryParams.get('error_description') || queryParams.get('error') || undefined;
          }
        }
      } else if (typeof input === 'object') {
        code = input.code;
        accessToken = input.access_token;
        refreshToken = input.refresh_token;
        errorDesc = input.error_description || input.error;
      }

      if (errorDesc) {
        return { user: null, error: decodeURIComponent(errorDesc) };
      }

      // 1. PKCE Authorization Code flow
      if (code) {
        if (this.processedCodes.has(code)) {
          const activeUser = await this.getCurrentUser();
          return { user: activeUser };
        }

        this.processedCodes.add(code);
        const { data: sessionData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.warn('[AuthService.handleAuthCallbackUrl] Exchange code error:', exchangeErr.message);
          const activeUser = await this.getCurrentUser();
          if (activeUser) return { user: activeUser };
          return { user: null, error: exchangeErr.message };
        }

        if (sessionData.user) {
          const user = await this.handleSupabaseUser(sessionData.user);
          return { user };
        }
      }

      // 2. Implicit / Hash token flow
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

      // 3. Fallback: check if session is already active
      const active = await this.getCurrentUser();
      return { user: active };
    } catch (e: any) {
      console.warn('[AuthService.handleAuthCallbackUrl] Error:', e);
      return { user: null, error: e?.message || 'Помилка обробки авторизації' };
    }
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

      const makeRedirect = getMakeRedirectUri();
      let redirectUrl = 'fitlog://auth/callback';
      if (makeRedirect) {
        try {
          const generated = makeRedirect({
            scheme: 'fitlog',
            path: 'auth/callback',
            native: 'fitlog://auth/callback',
          });
          if (generated) {
            // Clean up any double or triple slashes after scheme
            redirectUrl = generated.replace(/^(fitlog:\/)\/+/i, 'fitlog://');
          }
        } catch {
          redirectUrl = 'fitlog://auth/callback';
        }
      }

      console.log('[OAuth] Generated redirectUrl:', redirectUrl);

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

      console.log('[OAuth] Opening auth session with URL:', data.url);

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      console.log('[OAuth] WebBrowser result:', res.type);

      if (res.type === 'success' && res.url) {
        return await this.handleAuthCallbackUrl(res.url);
      }

      // If dismissed or cancelled, wait briefly and check if callback route or linking listener already established session
      await new Promise((resolve) => setTimeout(resolve, 800));
      const active = await this.getCurrentUser();
      if (active) {
        return { user: active };
      }

      if (res.type === 'cancel' || res.type === 'dismiss') {
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
