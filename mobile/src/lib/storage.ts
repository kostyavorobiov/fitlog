import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryFallback = new Map<string, string>();

export class MobileStorage {
  static async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      let value: string | null = null;
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        value = await AsyncStorage.getItem(key);
      }
      if (value === null) {
        value = memoryFallback.get(key) || null;
      }
      if (value === null) return defaultValue;
      return JSON.parse(value) as T;
    } catch (e) {
      const fallback = memoryFallback.get(key);
      if (fallback) {
        try {
          return JSON.parse(fallback) as T;
        } catch {}
      }
      return defaultValue;
    }
  }

  static async setItem<T>(key: string, value: T): Promise<boolean> {
    const serialized = JSON.stringify(value);
    memoryFallback.set(key, serialized);
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, serialized);
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  static async removeItem(key: string): Promise<boolean> {
    memoryFallback.delete(key);
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  static async clear(): Promise<boolean> {
    memoryFallback.clear();
    try {
      if (AsyncStorage && typeof AsyncStorage.clear === 'function') {
        await AsyncStorage.clear();
      }
      return true;
    } catch (e) {
      return true;
    }
  }
}
