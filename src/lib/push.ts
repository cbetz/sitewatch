import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export interface PushIdentity {
  token: string;
  /** "expo": real push token; "local": stable per-device fallback (Expo Go / permission denied) */
  mode: "expo" | "local";
}

const LOCAL_TOKEN_KEY = "sitewatch.localToken";

/**
 * Real Expo push tokens need a development build with an EAS projectId; in
 * Expo Go (or when permission is denied) we fall back to a stable local id so
 * watch CRUD still works end to end, just without deliverable notifications.
 */
export async function getPushIdentity(): Promise<PushIdentity> {
  try {
    if (Device.isDevice) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
        return { token, mode: "expo" };
      }
    }
  } catch {
    // fall through to the local fallback
  }
  let token = await AsyncStorage.getItem(LOCAL_TOKEN_KEY);
  if (!token) {
    token = `local:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await AsyncStorage.setItem(LOCAL_TOKEN_KEY, token);
  }
  return { token, mode: "local" };
}
