import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types/workout';
import { MobileStorage } from '../lib/storage';
import { AuthService } from './authService';

const TRAINEES_CACHE_KEY = 'mobile_trainees_cache';

export class TraineeService {
  /**
   * Fetch all trainees assigned to a specific coach
   */
  static async getTrainees(coachId: string): Promise<User[]> {
    if (!coachId) return [];

    const cacheKey = `${TRAINEES_CACHE_KEY}_${coachId}`;

    // 1. Try Supabase cloud
    if (isSupabaseConfigured() && supabase) {
      try {
        // Direct query: select profiles where coach_id = coachId
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('coach_id', coachId)
          .order('name', { ascending: true });

        if (!error && data) {
          const mapped: User[] = data.map((d: any) => ({
            id: d.id,
            profileCode: d.profile_code || d.id.slice(0, 8),
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Підопічний',
            email: d.email || '',
            image: d.avatar_url || '',
            role: 'athlete',
            coachId: d.coach_id,
            createdAt: d.created_at,
          }));

          await MobileStorage.setItem(cacheKey, mapped);
          return mapped;
        }

        // Fallback to RPC get_coach_trainees
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_coach_trainees', {
          p_coach_id: coachId,
        });

        if (!rpcErr && rpcData && Array.isArray(rpcData)) {
          const mapped: User[] = rpcData.map((d: any) => ({
            id: d.id,
            profileCode: d.profile_code || d.id.slice(0, 8),
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Підопічний',
            email: d.email || '',
            image: d.avatar_url || '',
            role: 'athlete',
            coachId: d.coach_id,
            createdAt: d.created_at,
          }));

          await MobileStorage.setItem(cacheKey, mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('[TraineeService.getTrainees] Error:', e);
      }
    }

    // 2. Return cached trainees
    return MobileStorage.getItem<User[]>(cacheKey, []);
  }

  /**
   * Search for a trainee by profileCode, email, or user ID
   */
  static async findProfileByCodeOrEmail(query: string): Promise<User | null> {
    const clean = query.trim();
    if (!clean) return null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const stripped = clean.toUpperCase().replace(/^U_/i, '');
        const cleanNoDashes = clean.toLowerCase().replace(/[-_]/g, '');

        // A. Match profile_code
        const { data: codeMatch } = await supabase
          .from('profiles')
          .select('*')
          .or(`profile_code.eq.${clean},profile_code.eq.u_${stripped.toLowerCase()},profile_code.eq.${stripped}`)
          .limit(1);

        if (codeMatch && codeMatch.length > 0) {
          const d = codeMatch[0];
          return {
            id: d.id,
            profileCode: d.profile_code || d.id.slice(0, 8),
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Підопічний',
            email: d.email || '',
            image: d.avatar_url || '',
            role: d.role || 'athlete',
            coachId: d.coach_id,
            createdAt: d.created_at,
          };
        }

        // B. Match email
        const { data: emailMatch } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', clean)
          .limit(1);

        if (emailMatch && emailMatch.length > 0) {
          const d = emailMatch[0];
          return {
            id: d.id,
            profileCode: d.profile_code || d.id.slice(0, 8),
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            name: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Підопічний',
            email: d.email || '',
            image: d.avatar_url || '',
            role: d.role || 'athlete',
            coachId: d.coach_id,
            createdAt: d.created_at,
          };
        }

        // C. Match ID prefix
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('*')
          .limit(100);

        if (allProfiles && allProfiles.length > 0) {
          const match = allProfiles.find((p: any) => {
            const pId = (p.id || '').toLowerCase().replace(/[-_]/g, '');
            const pCode = (p.profile_code || '').toLowerCase();
            return (
              pCode === clean.toLowerCase() ||
              pId === cleanNoDashes ||
              pId.startsWith(cleanNoDashes)
            );
          });

          if (match) {
            return {
              id: match.id,
              profileCode: match.profile_code || match.id.slice(0, 8),
              firstName: match.first_name || '',
              lastName: match.last_name || '',
              name: match.name || `${match.first_name || ''} ${match.last_name || ''}`.trim() || 'Підопічний',
              email: match.email || '',
              image: match.avatar_url || '',
              role: match.role || 'athlete',
              coachId: match.coach_id,
              createdAt: match.created_at,
            };
          }
        }
      } catch (e) {
        console.warn('[TraineeService.findProfileByCodeOrEmail] Error:', e);
      }
    }

    return null;
  }

  /**
   * Attach a trainee to a coach by code, email or ID
   */
  static async addTraineeByCode(
    coachId: string,
    codeOrEmail: string
  ): Promise<{ success: boolean; message: string; trainee?: User }> {
    const clean = codeOrEmail.trim();
    if (!clean) {
      return { success: false, message: 'Введіть ID, код або email підопічного' };
    }

    // Find profile
    const trainee = await this.findProfileByCodeOrEmail(clean);
    if (!trainee) {
      return {
        success: false,
        message: `Користувача з ID/кодом "${clean}" не знайдено`,
      };
    }

    if (trainee.id === coachId) {
      return { success: false, message: 'Неможливо додати себе у ролі підопічного' };
    }

    // Check if already assigned
    const currentTrainees = await this.getTrainees(coachId);
    if (currentTrainees.some((t) => t.id === trainee.id)) {
      return { success: false, message: `${trainee.name} вже є у вашому списку підопічних` };
    }

    // Assign in Supabase
    const assigned = await this.assignCoach(trainee.id, coachId);
    if (!assigned) {
      return { success: false, message: 'Не вдалося зберегти прив’язку на сервері' };
    }

    // Update local cache
    const cacheKey = `${TRAINEES_CACHE_KEY}_${coachId}`;
    const updatedList = [trainee, ...currentTrainees.filter((t) => t.id !== trainee.id)];
    await MobileStorage.setItem(cacheKey, updatedList);

    return {
      success: true,
      message: `Підопічного ${trainee.name} успішно прив'язано!`,
      trainee,
    };
  }

  /**
   * Unlink trainee from coach
   */
  static async unlinkTrainee(coachId: string, traineeId: string): Promise<boolean> {
    if (!coachId || !traineeId) return false;

    // 1. Remove from local cache
    const cacheKey = `${TRAINEES_CACHE_KEY}_${coachId}`;
    const cached = await MobileStorage.getItem<User[]>(cacheKey, []);
    const filtered = cached.filter((t) => t.id !== traineeId);
    await MobileStorage.setItem(cacheKey, filtered);

    // 2. Unlink in Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        // Try RPC unlink_trainee
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('unlink_trainee', {
          p_trainee_id: traineeId,
        });

        if (!rpcErr && rpcRes !== false) {
          return true;
        }

        // Direct table update fallback
        const { error } = await supabase
          .from('profiles')
          .update({ coach_id: null, updated_at: new Date().toISOString() })
          .eq('id', traineeId);

        return !error;
      } catch (e) {
        console.warn('[TraineeService.unlinkTrainee] Error:', e);
        return false;
      }
    }

    return true;
  }

  /**
   * Assign a coach to a trainee
   */
  static async assignCoach(traineeId: string, coachId: string): Promise<boolean> {
    if (!traineeId || !coachId) return false;

    if (isSupabaseConfigured() && supabase) {
      try {
        // Try RPC assign_trainee_to_coach first (bypasses RLS with security definer)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('assign_trainee_to_coach', {
          p_coach_id: coachId,
          p_trainee_id: traineeId,
        });

        if (!rpcErr && rpcRes !== false) {
          return true;
        }

        // Direct update fallback
        const { error } = await supabase
          .from('profiles')
          .update({ coach_id: coachId, updated_at: new Date().toISOString() })
          .eq('id', traineeId);

        return !error;
      } catch (e) {
        console.warn('[TraineeService.assignCoach] Error:', e);
        return false;
      }
    }

    return true;
  }

  /**
   * Fetch coach profile for a trainee
   */
  static async getCoach(coachId: string): Promise<User | null> {
    return AuthService.fetchProfile(coachId);
  }
}
