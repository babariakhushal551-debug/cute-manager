// Local notifications: gentle ritual reminders (morning plan / evening wrap) + task nudges.
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function triggerForHour(hour: number, minute = 0) {
  // DAILY trigger repeats once per day at the given hour/minute (matches SDK 57 types).
  return { type: SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: undefined } as const;
}

export async function scheduleRitualReminders(morningHour: number, eveningHour: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const ok = await ensureNotificationPermission();
  if (!ok) return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rituals", {
      name: "Daily rituals",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Good morning ☀️",
      body: "Your plan is ready — one small step at a time.",
    },
    trigger: triggerForHour(morningHour),
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Evening wrap-up 🌙",
      body: "What got done today? Two minutes to close the loop.",
    },
    trigger: triggerForHour(eveningHour),
  });

  return true;
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
