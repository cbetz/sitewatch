import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { Linking, Platform } from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Server pushes carry a Recreation.gov booking URL; tapping the alert should
// land the user on the site page with zero friction (that's the whole race).
function openFromNotification(response: Notifications.NotificationResponse | null) {
  const url = (response?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  if (typeof url === "string" && url.startsWith("https://www.recreation.gov/")) void Linking.openURL(url);
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void Notifications.getLastNotificationResponseAsync().then(openFromNotification);
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="campground/[id]" options={{ title: "Campground" }} />
    </Stack>
  );
}
