import { MobileStorage } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ExerciseCategory, DEFAULT_CATEGORIES, Exercise } from '../types/workout';
import { ExerciseService } from './exerciseService';

const CATEGORIES_KEY = '@fitlog_exercise_categories';
const EXERCISES_CACHE_KEY = 'mobile_exercises_cache';

type CategoryListener = (categories: ExerciseCategory[]) => void;
const listeners = new Set<CategoryListener>();

export class CategoryService {
  private static getStorageKey(userId?: string | null): string {
    return userId ? `${CATEGORIES_KEY}_${userId}` : CATEGORIES_KEY;
  }

  static subscribe(listener: CategoryListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  private static notify(categories: ExerciseCategory[]) {
    listeners.forEach((fn) => {
      try {
        fn(categories);
      } catch (e) {
        console.warn('[CategoryService] Listener error:', e);
      }
    });
  }

  /**
   * Get categories list for user or defaults.
   * Auto-migrates full_body -> glutes (Сідниці) after legs, and guarantees 'other' exists.
   */
  static async getCategories(userId?: string | null): Promise<ExerciseCategory[]> {
    const key = this.getStorageKey(userId);
    let cats = await MobileStorage.getItem<ExerciseCategory[] | null>(key, null);

    // If no custom categories cached yet, check Supabase user metadata
    if (!cats && isSupabaseConfigured() && supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (
          authData?.user?.user_metadata?.custom_categories &&
          Array.isArray(authData.user.user_metadata.custom_categories)
        ) {
          cats = authData.user.user_metadata.custom_categories;
          await MobileStorage.setItem(key, cats);
        }
      } catch (e) {
        console.warn('[CategoryService.getCategories] Auth check error:', e);
      }
    }

    if (!cats || cats.length === 0) {
      cats = [...DEFAULT_CATEGORIES];
      await MobileStorage.setItem(key, cats);
    } else {
      let changed = false;

      // Replace legacy full_body with glutes (Сідниці) placed after legs
      const fullBodyIdx = cats.findIndex((c) => c.id === 'full_body');
      if (fullBodyIdx !== -1) {
        cats = cats.filter((c) => c.id !== 'full_body');
        const legsIdx = cats.findIndex((c) => c.id === 'legs');
        const glutesCat: ExerciseCategory = {
          id: 'glutes',
          nameUk: 'Сідниці',
          color: '#ec4899',
          badgeBg: 'rgba(236, 72, 153, 0.1)',
          badgeBorder: 'rgba(236, 72, 153, 0.3)',
          iconName: 'flame',
          isDefault: true,
        };
        if (legsIdx !== -1) {
          cats.splice(legsIdx + 1, 0, glutesCat);
        } else {
          cats.push(glutesCat);
        }
        changed = true;
      }

      // Ensure glutes (Сідниці) exists
      if (!cats.some((c) => c.id === 'glutes')) {
        const legsIdx = cats.findIndex((c) => c.id === 'legs');
        const glutesCat: ExerciseCategory = {
          id: 'glutes',
          nameUk: 'Сідниці',
          color: '#ec4899',
          badgeBg: 'rgba(236, 72, 153, 0.1)',
          badgeBorder: 'rgba(236, 72, 153, 0.3)',
          iconName: 'flame',
          isDefault: true,
        };
        if (legsIdx !== -1) {
          cats.splice(legsIdx + 1, 0, glutesCat);
        } else {
          cats.push(glutesCat);
        }
        changed = true;
      }

      // Ensure glutes is placed right after legs
      const legsIdx = cats.findIndex((c) => c.id === 'legs');
      const glutesIdx = cats.findIndex((c) => c.id === 'glutes');
      if (legsIdx !== -1 && glutesIdx !== -1 && glutesIdx !== legsIdx + 1) {
        const [glutesCat] = cats.splice(glutesIdx, 1);
        const newLegsIdx = cats.findIndex((c) => c.id === 'legs');
        cats.splice(newLegsIdx + 1, 0, glutesCat);
        changed = true;
      }

      // Ensure 'other' (Інше) exists at the end
      const otherIdx = cats.findIndex((c) => c.id === 'other');
      if (otherIdx === -1) {
        cats.push({
          id: 'other',
          nameUk: 'Інше',
          color: '#a1a1aa',
          badgeBg: 'rgba(113, 113, 122, 0.1)',
          badgeBorder: 'rgba(113, 113, 122, 0.3)',
          iconName: 'ellipsis-horizontal',
          isDefault: true,
        });
        changed = true;
      }

      if (changed) {
        await MobileStorage.setItem(key, cats);
      }
    }

    return cats;
  }

  /**
   * Save categories list locally and to Supabase auth user_metadata
   */
  static async saveCategories(categories: ExerciseCategory[], userId?: string | null): Promise<boolean> {
    const key = this.getStorageKey(userId);
    await MobileStorage.setItem(key, categories);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.updateUser({
          data: { custom_categories: categories },
        });
      } catch (e) {
        console.warn('[CategoryService.saveCategories] Supabase sync error:', e);
      }
    }

    this.notify(categories);
    return true;
  }

  /**
   * Add a new category
   */
  static async addCategory(nameUk: string, userId?: string | null): Promise<ExerciseCategory[]> {
    const clean = nameUk.trim();
    if (!clean) return await this.getCategories(userId);

    const categories = await this.getCategories(userId);
    if (categories.some((c) => c.nameUk.toLowerCase() === clean.toLowerCase())) {
      return categories;
    }

    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newCat: ExerciseCategory = {
      id,
      nameUk: clean,
      color: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.1)',
      badgeBorder: 'rgba(168, 85, 247, 0.3)',
      iconName: 'barbell-outline',
      isDefault: false,
    };

    // Insert before 'other'
    const otherIdx = categories.findIndex((c) => c.id === 'other');
    if (otherIdx !== -1) {
      categories.splice(otherIdx, 0, newCat);
    } else {
      categories.push(newCat);
    }

    await this.saveCategories(categories, userId);
    return categories;
  }

  /**
   * Delete category and transfer all exercises with that category to 'other'
   */
  static async deleteCategory(
    categoryId: string,
    userId?: string | null
  ): Promise<{ categories: ExerciseCategory[]; movedCount: number }> {
    if (categoryId === 'other') {
      const current = await this.getCategories(userId);
      return { categories: current, movedCount: 0 };
    }

    let categories = await this.getCategories(userId);
    const catToDelete = categories.find((c) => c.id === categoryId);
    if (!catToDelete) {
      return { categories, movedCount: 0 };
    }

    // 1. Remove category from list
    categories = categories.filter((c) => c.id !== categoryId);
    await this.saveCategories(categories, userId);

    // 2. Transfer all exercises with this category to 'other'
    let movedCount = 0;
    try {
      const cachedExercises = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
      const exercisesToUpdate: Exercise[] = [];

      cachedExercises.forEach((ex) => {
        if (ex.muscleGroup === categoryId || ex.muscleGroup === catToDelete.nameUk) {
          ex.muscleGroup = 'other';
          exercisesToUpdate.push(ex);
          movedCount++;
        }
      });

      if (exercisesToUpdate.length > 0) {
        await MobileStorage.setItem(EXERCISES_CACHE_KEY, cachedExercises);
        for (const ex of exercisesToUpdate) {
          try {
            await ExerciseService.updateExercise(ex, userId || undefined, true);
          } catch (err) {
            console.warn('[CategoryService.deleteCategory] Failed to update exercise in cloud:', ex.id, err);
          }
        }
      }

      // Also update embedded exercises in local workouts cache
      try {
        const workouts = await MobileStorage.getItem<any[]>('@fitlog_workouts', []);
        let updatedWorkouts = false;
        workouts.forEach((w) => {
          (w.exercises || []).forEach((we: any) => {
            if (we.muscleGroup === categoryId || we.muscleGroup === catToDelete.nameUk) {
              we.muscleGroup = 'other';
              updatedWorkouts = true;
            }
          });
        });
        if (updatedWorkouts) {
          await MobileStorage.setItem('@fitlog_workouts', workouts);
        }
      } catch {}
    } catch (e) {
      console.warn('[CategoryService.deleteCategory] Migration to other error:', e);
    }

    return { categories, movedCount };
  }

  /**
   * Reset categories to defaults
   */
  static async resetCategories(userId?: string | null): Promise<ExerciseCategory[]> {
    const defaults = [...DEFAULT_CATEGORIES];
    await this.saveCategories(defaults, userId);
    return defaults;
  }
}

