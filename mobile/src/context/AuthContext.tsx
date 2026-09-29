import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types/workout';
import { AuthService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: (type?: 'admin' | 'athlete' | 'coach', custom?: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await AuthService.getCurrentUser();
      setUser(current);
    } catch (e) {
      console.warn('[AuthContext.refreshUser] Error:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const initialUser = await AuthService.getCurrentUser();
        if (isMounted) {
          setUser(initialUser);
        }
      } catch (err) {
        console.warn('[AuthProvider] Initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const unsubscribe = AuthService.onAuthStateChange((updatedUser) => {
      if (isMounted) {
        setUser(updatedUser);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await AuthService.signInWithGoogle();
      if (res.user) {
        setUser(res.user);
        setIsLoading(false);
        return { success: true };
      }
      setIsLoading(false);
      return { success: false, error: res.error || 'Не вдалося увійти через Google' };
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: e?.message || 'Помилка Google OAuth' };
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await AuthService.signInWithEmail(email, password);
      if (res.user) {
        setUser(res.user);
        setIsLoading(false);
        return { success: true };
      }
      setIsLoading(false);
      return { success: false, error: res.error || 'Невірний email або пароль' };
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: e?.message || 'Помилка авторизації' };
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole = 'athlete'
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await AuthService.signUpWithEmail(email, password, firstName, lastName, role);
      if (res.user) {
        setUser(res.user);
        setIsLoading(false);
        return { success: true };
      }
      setIsLoading(false);
      return { success: false, error: res.error || 'Не вдалося створити обліковий запис' };
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, error: e?.message || 'Помилка реєстрації' };
    }
  };

  const loginAsDemo = async (type: 'admin' | 'athlete' | 'coach' = 'admin', custom?: Partial<User>): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await AuthService.loginAsDemo(type, custom);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginAsDemo,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
