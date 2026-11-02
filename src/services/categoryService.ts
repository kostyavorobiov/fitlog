import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ExerciseCategory, DEFAULT_CATEGORIES, Exercise } from '../types/workout';
import { StorageService } from './storageService';

const CATEGORIES_KEY = '@fitlog_exercise_categories';

type CategoryListener = (categories: ExerciseCategory[]) => void;
const listeners = new Set<CategoryListener>();
const memoryFallback = new Map<string, string>();

export class CategoryService {
  private static getStorageKey(userId?: string | null): string {
    return userId ? `${CATEGORIES_KEY}_${userId}` : CATEGORIES_KEY;
  }

  private static getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryFallback.get(key) || null;
  }

  private static setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
    memoryFallback.set(key, value);
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
    let cats: ExerciseCategory[] | null = null;

    const raw = this.getItem(key);
    if (raw) {
      try {
        cats = JSON.parse(raw);
      } catch {}
    }

    // If no custom categories cached yet, check Supabase user metadata
    if (!cats && isSupabaseConfigured() && supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (
          authData?.user?.user_metadata?.custom_categories &&
          Array.isArray(authData.user.user_metadata.custom_categories)
        ) {
          cats = authData.user.user_metadata.custom_categories;
          this.setItem(key, JSON.stringify(cats));
        }
      } catch (e) {
        console.warn('[CategoryService.getCategories] Auth check error:', e);
      }
    }

    if (!cats || cats.length === 0) {
      cats = [...DEFAULT_CATEGORIES];
      this.setItem(key, JSON.stringify(cats));
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
          color: 'text-pink-400',
          badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
          badgeBorder: 'border-pink-500/30',
          iconName: 'Flame',
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
          color: 'text-pink-400',
          badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
          badgeBorder: 'border-pink-500/30',
          iconName: 'Flame',
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
          color: 'text-zinc-400',
          badgeBg: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
          badgeBorder: 'border-zinc-500/30',
          iconName: 'Activity',
          isDefault: true,
        });
        changed = true;
      }

      if (changed) {
        this.setItem(key, JSON.stringify(cats));
      }
    }

    return cats;
  }

  /**
   * Save categories list locally and to Supabase auth user_metadata
   */
  static async saveCategories(categories: ExerciseCategory[], userId?: string | null): Promise<boolean> {
    const key = this.getStorageKey(userId);
    this.setItem(key, JSON.stringify(categories));

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
      color: 'text-purple-400',
      badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      badgeBorder: 'border-purple-500/30',
      iconName: 'Dumbbell',
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
      const allExercises = StorageService.getExercises(userId);
      for (const ex of allExercises) {
        if (ex.muscleGroup === categoryId || ex.muscleGroup === catToDelete.nameUk) {
          const updated: Exercise = { ...ex, muscleGroup: 'other' };
          StorageService.updateExercise(updated);
          movedCount++;
        }
      }
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
