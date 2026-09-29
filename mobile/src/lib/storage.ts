import AsyncStorage from '@react-native-async-storage/async-storage';

export class MobileStorage {
  static async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return defaultValue;
      return JSON.parse(value) as T;
    } catch (e) {
      console.warn(`[MobileStorage] Error reading key "${key}":`, e);
      return defaultValue;
    }
  }

  static async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[MobileStorage] Error saving key "${key}":`, e);
      return false;
    }
  }

  static async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`[MobileStorage] Error removing key "${key}":`, e);
      return false;
    }
  }

  static async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (e) {
      console.warn('[MobileStorage] Error clearing storage:', e);
      return false;
    }
  }
}
