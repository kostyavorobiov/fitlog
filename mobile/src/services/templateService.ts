import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { MobileStorage } from '../lib/storage';

export interface WorkoutTemplate {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt?: string;
}

const TEMPLATES_CACHE_KEY = 'mobile_workout_templates';

export class TemplateService {
  /**
   * Get all templates for a user (from Supabase with local storage fallback)
   */
  static async getTemplates(userId: string): Promise<WorkoutTemplate[]> {
    if (!userId) return [];

    const cacheKey = `${TEMPLATES_CACHE_KEY}_${userId}`;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    if (isSupabaseConfigured() && supabase && isUuid) {
      try {
        const { data, error } = await supabase
          .from('workout_templates')
          .select('id, user_id, title, notes, data, created_at, updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mapped: WorkoutTemplate[] = data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            notes: row.notes || '',
            exercises: Array.isArray(row.data) ? row.data : (row.data?.exercises || []),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          // Cache locally
          await MobileStorage.setItem(cacheKey, JSON.stringify(mapped));
          return mapped;
        }
      } catch (e) {
        console.warn('[TemplateService.getTemplates] Supabase error:', e);
      }
    }

    // Fallback to local storage
    try {
      const cached = await MobileStorage.getItem<WorkoutTemplate[]>(cacheKey, []);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch {}

    return [];
  }

  /**
   * Save (create or update) a workout template
   */
  static async saveTemplate(template: WorkoutTemplate): Promise<boolean> {
    if (!template || !template.userId) return false;

    const cacheKey = `${TEMPLATES_CACHE_KEY}_${template.userId}`;

    // 1. Update local cache immediately
    try {
      const list = await MobileStorage.getItem<WorkoutTemplate[]>(cacheKey, []);
      const updatedList = [template, ...list.filter((t) => t.id !== template.id)];
      await MobileStorage.setItem(cacheKey, updatedList);
    } catch (e) {
      console.warn('[TemplateService.saveTemplate] Local cache error:', e);
    }

    // 2. Sync to Supabase if available
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.userId);
    if (isSupabaseConfigured() && supabase && isUuid) {
      try {
        const { error } = await supabase.from('workout_templates').upsert(
          {
            id: template.id,
            user_id: template.userId,
            title: template.title,
            notes: template.notes || '',
            data: template.exercises || [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.warn('[TemplateService.saveTemplate] Supabase upsert error:', error);
          return false;
        }
      } catch (e) {
        console.warn('[TemplateService.saveTemplate] Supabase error:', e);
        return false;
      }
    }

    return true;
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    if (!userId || !templateId) return false;

    const cacheKey = `${TEMPLATES_CACHE_KEY}_${userId}`;

    // 1. Update local cache
    try {
      const list = await MobileStorage.getItem<WorkoutTemplate[]>(cacheKey, []);
      const filtered = list.filter((t) => t.id !== templateId);
      await MobileStorage.setItem(cacheKey, filtered);
    } catch {}

    // 2. Delete from Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (isSupabaseConfigured() && supabase && isUuid) {
      try {
        await supabase
          .from('workout_templates')
          .delete()
          .eq('id', templateId)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[TemplateService.deleteTemplate] Supabase error:', e);
      }
    }

    return true;
  }

  /**
   * Instantiate an independent WorkoutPlan from a template
   */
  static createWorkoutFromTemplate(
    template: WorkoutTemplate,
    userId: string,
    scheduledDate?: string
  ): WorkoutPlan {
    const today = scheduledDate || new Date().toISOString().split('T')[0];
    const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const clonedExercises: WorkoutExercise[] = (template.exercises || []).map((ex, exIdx) => {
      const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
      const clonedSets: WorkoutSet[] = (ex.sets || []).map((s, sIdx) => ({
        id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        setNumber: sIdx + 1,
        targetRepsRange: s.targetRepsRange || ex.targetRepsRange || '8-12',
        weight: Number(s.weight) || 0,
        actualReps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 10,
        completedAt: null,
        isWarmup: Boolean(s.isWarmup),
      }));

      return {
        ...ex,
        id: weId,
        workoutPlanId: workoutId,
        sets: clonedSets,
      };
    });

    return {
      id: workoutId,
      userId,
      title: template.title || 'Тренування з шаблону',
      scheduledDate: today,
      status: 'planned',
      notes: template.notes || '',
      createdAt: new Date().toISOString(),
      exercises: clonedExercises,
    };
  }
}
