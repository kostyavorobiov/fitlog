import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/workout';
import { StorageService, generateCuid } from '../services/storageService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CloudStorageService } from '../services/cloudStorageService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: (customEmail?: string, customName?: string, customRole?: UserRole) => Promise<void>;
  logout: () => Promise<void> | void;
  switchUser: (userId: string) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  allUsers: User[];
  isAdmin: boolean;
  isCoach: boolean;
  isCloudConnected: boolean;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'cmug5e9xj0000j5d57meirzop',
    profileCode: 'cmug5e9xj0000j5d57meirzop',
    firstName: 'Костянтин',
    lastName: 'Воробйов',
    name: 'Костянтин Воробйов',
    email: 'kvorobiov9@gmail.com',
    role: 'admin',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    traineeIds: ['usr_trainee_1', 'usr_trainee_2'],
    createdAt: '2026-01-10T12:00:00.000Z',
  },
  {
    id: 'cmua8f1ka0000k9d82leirx01',
    profileCode: 'cmua8f1ka0000k9d82leirx01',
    firstName: 'Олександр',
    lastName: 'Коваленко',
    name: 'Олександр Коваленко',
    email: 'coach.alex@gmail.com',
    role: 'coach',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    traineeIds: ['usr_trainee_1'],
    createdAt: '2026-01-15T12:00:00.000Z',
  },
  {
    id: 'usr_trainee_1',
    profileCode: 'cmua9f2kb0000l8d73meirx02',
    firstName: 'Іван',
    lastName: 'Петренко',
    name: 'Іван Петренко',
    email: 'ivan.petrenko@gmail.com',
    role: 'athlete',
    coachId: 'cmug5e9xj0000j5d57meirzop',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-01-20T12:00:00.000Z',
  },
  {
    id: 'usr_trainee_2',
    profileCode: 'cmua0f3kc0000m7d64neirx03',
    firstName: 'Марія',
    lastName: 'Коваль',
    name: 'Марія Коваль',
    email: 'maria.koval@gmail.com',
    role: 'athlete',
    coachId: 'cmug5e9xj0000j5d57meirzop',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-01-22T12:00:00.000Z',
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isCloudConnected = isSupabaseConfigured();

  const handleSupabaseUser = async (sbUser: any) => {
    try {
      let profile = await CloudStorageService.fetchProfile(sbUser.id);
      const email = sbUser.email || '';
      const isHardcodedAdmin = email.toLowerCase() === 'kvorobiov9@gmail.com';
      const userMeta = sbUser.user_metadata || {};
      const fullName = userMeta.full_name || userMeta.name || email.split('@')[0] || 'Користувач';
      const nameParts = fullName.trim().split(' ');
      const firstName = userMeta.first_name || nameParts[0] || 'Користувач';
      const lastName = userMeta.last_name || nameParts.slice(1).join(' ') || '';
      const avatarUrl = userMeta.avatar_url || userMeta.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;

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
        await CloudStorageService.upsertProfile(profile);
      } else if (isHardcodedAdmin && profile.role !== 'admin') {
        profile.role = 'admin';
        await CloudStorageService.updateProfile(profile.id, { role: 'admin' });
      }

      setUser(profile);
      StorageService.saveUser(profile);
      StorageService.setActiveUserId(profile.id);

      // Background cloud sync
      StorageService.syncWithCloud(profile.id).catch((err) =>
        console.warn('Initial cloud sync error:', err)
      );

      setAllUsers(StorageService.getUsers());
    } catch (e) {
      console.warn('handleSupabaseUser error:', e);
    }
  };

  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      // 1. Initialize local users baseline
      let storedUsers = StorageService.getUsers();
      if (storedUsers.length === 0) {
        DEFAULT_USERS.forEach((u) => StorageService.saveUser(u));
        storedUsers = StorageService.getUsers();
      } else {
        // Ensure all stored users have profileCode and role
        storedUsers = storedUsers.map((u) => {
          let modified = false;
          const copy = { ...u };
          if (!copy.profileCode || copy.profileCode.startsWith('USR-')) {
            copy.profileCode = copy.email.toLowerCase() === 'kvorobiov9@gmail.com' ? 'cmug5e9xj0000j5d57meirzop' : generateCuid();
            modified = true;
          }
          if (!copy.role) {
            copy.role = copy.email.toLowerCase() === 'kvorobiov9@gmail.com' ? 'admin' : 'athlete';
            modified = true;
          }
          if (copy.email.toLowerCase() === 'kvorobiov9@gmail.com' && copy.role !== 'admin') {
            copy.role = 'admin';
            modified = true;
          }
          if (modified) {
            StorageService.saveUser(copy);
          }
          return copy;
        });

        // Ensure demo trainees exist
        if (!storedUsers.some((u) => u.id === 'usr_trainee_1')) {
          DEFAULT_USERS.slice(1).forEach((du) => {
            if (!storedUsers.some((su) => su.email === du.email)) {
              StorageService.saveUser(du);
              storedUsers.push(du);
            }
          });
        }
      }
      setAllUsers(storedUsers);

      // 2. Check Supabase Cloud Auth if configured
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await handleSupabaseUser(session.user);
          } else {
            const activeId = StorageService.getActiveUserId();
            const current = storedUsers.find((u) => u.id === activeId) || storedUsers[0];
            setUser(current);
            if (current) {
              StorageService.setActiveUserId(current.id);
            }
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
              await handleSupabaseUser(session.user);
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
              StorageService.setActiveUserId(null);
            }
          });
          authSubscription = subscription;
        } catch (err) {
          console.warn('Supabase initialization error, falling back to local state:', err);
          const activeId = StorageService.getActiveUserId();
          const current = storedUsers.find((u) => u.id === activeId) || storedUsers[0];
          setUser(current);
        }
      } else {
        const activeId = StorageService.getActiveUserId();
        const current = storedUsers.find((u) => u.id === activeId) || storedUsers[0];
        setUser(current);
        if (current) {
          StorageService.setActiveUserId(current.id);
          StorageService.seedDemoDataIfEmpty(current);
        }
      }

      setIsLoading(false);
    };

    initAuth();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const loginWithGoogle = async (customEmail?: string, customName?: string, customRole?: UserRole) => {
    setIsLoading(true);

    // If Supabase is configured and no manual override is requested, use official Google OAuth
    if (isSupabaseConfigured() && supabase && !customEmail) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error.message);
        setIsLoading(false);
        throw error;
      }
      return;
    }

    // Local demo / simulation fallback
    await new Promise((resolve) => setTimeout(resolve, 350));

    const email = customEmail || 'kvorobiov9@gmail.com';
    const isHardcodedAdmin = email.toLowerCase() === 'kvorobiov9@gmail.com';
    const rawName = customName || (email.split('@')[0].replace('.', ' ').replace(/^./, (c) => c.toUpperCase()));
    const nameParts = rawName.trim().split(' ');
    const firstName = nameParts[0] || 'Атлет';
    const lastName = nameParts.slice(1).join(' ') || '';

    const users = StorageService.getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      if (isHardcodedAdmin && existing.role !== 'admin') {
        existing.role = 'admin';
        StorageService.saveUser(existing);
      }
      setUser(existing);
      StorageService.setActiveUserId(existing.id);
    } else {
      const cuid = isHardcodedAdmin ? 'cmug5e9xj0000j5d57meirzop' : generateCuid();
      const newUser: User = {
        id: cuid,
        profileCode: cuid,
        firstName,
        lastName,
        name: rawName,
        email,
        role: isHardcodedAdmin ? 'admin' : (customRole || 'athlete'),
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawName)}`,
        createdAt: new Date().toISOString(),
      };
      StorageService.saveUser(newUser);
      StorageService.setActiveUserId(newUser.id);
      StorageService.seedDemoDataIfEmpty(newUser);
      setUser(newUser);
      setAllUsers(StorageService.getUsers());
    }
    setIsLoading(false);
  };

  const logout = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    setUser(null);
    StorageService.setActiveUserId(null);
  };

  const switchUser = (userId: string) => {
    const users = StorageService.getUsers();
    const target = users.find((u) => u.id === userId);
    if (target) {
      setUser(target);
      StorageService.setActiveUserId(target.id);
      StorageService.seedDemoDataIfEmpty(target);
    }
  };

  const updateUserProfile = (updates: Partial<User>) => {
    if (!user) return;
    const updated: User = {
      ...user,
      ...updates,
      role: user.email.toLowerCase() === 'kvorobiov9@gmail.com' ? 'admin' : (updates.role || user.role),
      name: `${updates.firstName ?? user.firstName} ${updates.lastName ?? user.lastName}`.trim(),
    };
    StorageService.saveUser(updated);
    setUser(updated);
    setAllUsers(StorageService.getUsers());

    // Update in cloud if connected
    if (isSupabaseConfigured() && supabase) {
      CloudStorageService.updateProfile(user.id, updates).catch((err) =>
        console.warn('Cloud updateProfile error:', err)
      );
    }
  };

  const isAdmin = user?.email.toLowerCase() === 'kvorobiov9@gmail.com' || user?.role === 'admin';
  const isCoach = user?.role === 'coach' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogle,
        logout,
        switchUser,
        updateUserProfile,
        allUsers,
        isAdmin,
        isCoach,
        isCloudConnected,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

