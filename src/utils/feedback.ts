import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function safely(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  try {
    await run();
  } catch {
    // Haptics are an enhancement and should never block an interaction.
  }
}

export const feedback = {
  selection: () => safely(() => Haptics.selectionAsync()),
  success: () =>
    safely(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    safely(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
};
