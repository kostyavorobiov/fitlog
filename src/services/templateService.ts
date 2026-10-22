import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { StorageService } from './storageService';

export interface WorkoutTemplate {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt?: string;
}

const TEMPLATES_STORAGE_KEY = 'workout_templates';

export class TemplateService {
  /**
   * Get all templates for a user (from Supabase with localStorage fallback)
   */
  static async getTemplates(userId: string): Promise<WorkoutTemplate[]> {
    if (!userId) return [];

    const storageKey = `${TEMPLATES_STORAGE_KEY}_${userId}`;
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

          // Cache locally in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(mapped));
          }
          return mapped;
        }
      } catch (e) {
        console.warn('[TemplateService.getTemplates] Supabase error:', e);
      }
    }

    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {}
    }

    return [];
  }

  /**
   * Save (create or update) a workout template
   */
  static async saveTemplate(template: WorkoutTemplate): Promise<boolean> {
    if (!template || !template.userId) return false;

    const storageKey = `${TEMPLATES_STORAGE_KEY}_${template.userId}`;

    // 1. Local update
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        let list: WorkoutTemplate[] = raw ? JSON.parse(raw) : [];
        list = [template, ...list.filter((t) => t.id !== template.id)];
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (e) {
        console.warn('[TemplateService.saveTemplate] LocalStorage error:', e);
      }
    }

    // 2. Supabase sync
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

    const storageKey = `${TEMPLATES_STORAGE_KEY}_${userId}`;

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const list: WorkoutTemplate[] = JSON.parse(raw);
          const filtered = list.filter((t) => t.id !== templateId);
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        }
      } catch {}
    }

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
   * Create an independent WorkoutPlan from a template
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
