import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Triggers success haptic feedback after pull-to-refresh or data reload completes.
 * Works reliably across iOS, Android and supported mobile browsers.
 */
export const triggerRefreshSuccessHaptic = async (): Promise<void> => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([35, 50, 35]);
    }
  } catch {}
};
