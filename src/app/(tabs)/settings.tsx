import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DEFAULT_SERVER_URL, getServerUrl, setServerUrl } from "../../lib/config";
import { getPushIdentity } from "../../lib/push";
import { Colors, Spacing } from "../../lib/theme";

export default function SettingsScreen() {
  const [serverUrl, setServerUrlState] = useState("");
  const [pushMode, setPushMode] = useState<"expo" | "local" | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getServerUrl().then(setServerUrlState);
    void getPushIdentity().then((identity) => setPushMode(identity.mode));
  }, []);

  async function save() {
    await setServerUrl(serverUrl === DEFAULT_SERVER_URL ? null : serverUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Server</Text>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrlState}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>{saved ? "Saved" : "Save server URL"}</Text>
      </Pressable>

      <Text style={styles.label}>Notifications</Text>
      <Text style={styles.body}>
        {pushMode === "expo"
          ? "Push notifications are active for this device."
          : pushMode === "local"
            ? "Running without a push token (Expo Go or permission denied). Watches work, but notifications need a development build with an EAS project."
            : "Checking..."}
      </Text>

      <Text style={styles.label}>About</Text>
      <Text style={styles.body}>
        SiteWatch is open source (MIT) and scans politely: only watched campgrounds, honest User-Agent, and
        booking always happens on Recreation.gov.
      </Text>
      <Pressable onPress={() => Linking.openURL("https://github.com/cbetz/sitewatch")}>
        <Text style={styles.link}>github.com/cbetz/sitewatch</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm, textTransform: "uppercase" },
  input: { backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: Spacing.md, height: 42, color: Colors.text },
  button: { backgroundColor: Colors.accent, borderRadius: 8, alignItems: "center", paddingVertical: 10, marginTop: Spacing.sm },
  buttonText: { color: "#fff", fontWeight: "600" },
  body: { color: Colors.text, lineHeight: 20 },
  link: { color: Colors.accent, fontWeight: "600", marginTop: Spacing.sm },
});
