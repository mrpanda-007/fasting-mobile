import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const channelId = 'fasting-targets';

export async function scheduleTargetNotification(targetAt: number, phase: 'fast' | 'refeed') {
  if (targetAt <= Date.now()) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, { name: 'Fasting timers', importance: Notifications.AndroidImportance.DEFAULT, vibrationPattern: [0, 150] });
  }
  const permissions = await Notifications.getPermissionsAsync();
  const finalPermissions = permissions.granted ? permissions : await Notifications.requestPermissionsAsync();
  if (!finalPermissions.granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: phase === 'fast' ? 'Fast target reached' : 'Refeed target reached', body: 'Your timer keeps going until you choose to end this phase.', sound: false },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(targetAt), channelId },
  });
}

export async function cancelTargetNotification(notificationId: string | null) {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}
