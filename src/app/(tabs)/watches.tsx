import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { deleteWatch, listWatches } from "../../api/server";
import type { Watch } from "../../api/types";
import { shortDate } from "../../lib/dates";
import { getPushIdentity } from "../../lib/push";
import { Colors, Spacing } from "../../lib/theme";

export default function WatchesScreen() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { token } = await getPushIdentity();
      setWatches(await listWatches(token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watches");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function remove(watch: Watch) {
    const doDelete = async () => {
      try {
        const { token } = await getPushIdentity();
        await deleteWatch(watch.id, token);
        setWatches((prev) => prev?.filter((w) => w.id !== watch.id) ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    };
    if (Platform.OS === "web") {
      void doDelete();
    } else {
      Alert.alert("Delete watch", `Stop watching ${watch.campgroundName ?? watch.campgroundId}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void doDelete() },
      ]);
    }
  }

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {watches === null && !error ? <ActivityIndicator style={styles.spinner} color={Colors.accent} /> : null}
      {watches !== null && watches.length === 0 ? (
        <Text style={styles.hint}>
          No active watches. Find a campground in Explore, pick your dates, and tap Watch.
        </Text>
      ) : null}
      <FlatList
        data={watches ?? []}
        keyExtractor={(w) => w.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <Text style={styles.name}>{item.campgroundName ?? `Campground ${item.campgroundId}`}</Text>
              <Text style={styles.dates}>
                {shortDate(item.startDate)} to {shortDate(item.endDate)}
                {item.siteTypes?.length ? ` · ${item.siteTypes.join(", ")}` : ""}
              </Text>
            </View>
            <Pressable onPress={() => remove(item)} hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  spinner: { marginTop: Spacing.lg },
  error: { color: Colors.danger, textAlign: "center", margin: Spacing.md },
  hint: { color: Colors.textSecondary, textAlign: "center", margin: Spacing.lg, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: Colors.text },
  dates: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  delete: { color: Colors.danger, fontWeight: "600" },
});
