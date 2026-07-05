import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const OVERRIDE_KEY = "sitewatch.serverUrl";

export const DEFAULT_SERVER_URL: string =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) ?? "https://sitewatch-flame.vercel.app";

export async function getServerUrl(): Promise<string> {
  const override = await AsyncStorage.getItem(OVERRIDE_KEY);
  return override?.trim() || DEFAULT_SERVER_URL;
}

export async function setServerUrl(url: string | null): Promise<void> {
  if (url && url.trim()) await AsyncStorage.setItem(OVERRIDE_KEY, url.trim().replace(/\/+$/, ""));
  else await AsyncStorage.removeItem(OVERRIDE_KEY);
}
