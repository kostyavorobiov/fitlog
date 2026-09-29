import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types/workout';
import { AuthService } from './authService';

export class TraineeService {
  /**
   * Fetch all trainees assigned to a specific coach
   */
  static async getTrainees(coachId: string): Promise<User[]> {
    if (!isSupabaseConfigured() || !supabase || !coachId) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('coach_id', coachId);

      if (!error && data) {
        return data.map((d: any) => ({
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
      }
    } catch (e) {
      console.warn('[TraineeService.getTrainees] Error:', e);
    }

    return [];
  }

  /**
   * Assign a coach to a trainee by coach profileCode or coachId
   */
  static async assignCoach(traineeId: string, coachId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase || !traineeId || !coachId) return false;

    try {
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

  /**
   * Fetch coach profile for a trainee
   */
  static async getCoach(coachId: string): Promise<User | null> {
    return AuthService.fetchProfile(coachId);
  }
}
