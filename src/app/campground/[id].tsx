import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchMonthAvailability } from "../../api/recgov";
import { createWatch } from "../../api/server";
import type { MonthAvailability } from "../../api/types";
import { AvailabilityGrid } from "../../components/AvailabilityGrid";
import { addMonths, monthLabel, monthStart, shortDate, todayISO } from "../../lib/dates";
import { getPushIdentity } from "../../lib/push";
import { Colors, isBookable, Spacing } from "../../lib/theme";

interface Selection {
  start: string | null;
  end: string | null;
}

export default function CampgroundScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [data, setData] = useState<MonthAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>({ start: null, end: null });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMonth = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        setData(await fetchMonthAvailability(String(id), month));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load availability");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, month],
  );

  useEffect(() => {
    void loadMonth("initial");
  }, [loadMonth]);

  // Stable identity so the grid's memoized rows never re-render on selection.
  const pressDate = useCallback((date: string) => {
    setSel((prev) => {
      if (!prev.start || (prev.start && prev.end)) return { start: date, end: null };
      if (date < prev.start) return { start: date, end: prev.end };
      return { start: prev.start, end: date };
    });
  }, []);

  const siteTypes = useMemo(
    () => [...new Set((data?.sites ?? []).map((s) => s.type).filter(Boolean))].sort(),
    [data],
  );

  // Sites bookable for every selected night shown in this month's data.
  const openSiteCount = useMemo(() => {
    if (!data || !sel.start) return null;
    const end = sel.end ?? sel.start;
    const nights = data.dates.filter((d) => d >= sel.start! && d <= end);
    if (nights.length === 0) return null;
    return data.sites.filter((s) => {
      if (selectedTypes.length && !selectedTypes.some((t) => s.type.toUpperCase().includes(t.toUpperCase()))) {
        return false;
      }
      return nights.every((d) => isBookable(s.days[d]));
    }).length;
  }, [data, sel, selectedTypes]);

  const atCurrentMonth = month <= monthStart(new Date());

  function toggleType(type: string) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  const canWatch = Boolean(sel.start && (sel.end ?? sel.start) >= todayISO()) && !saving;

  async function watch() {
    if (!sel.start) return;
    setSaving(true);
    try {
      const { token, mode } = await getPushIdentity();
      await createWatch({
        pushToken: token,
        campgroundId: String(id),
        campgroundName: typeof name === "string" ? name : undefined,
        startDate: sel.start,
        endDate: sel.end ?? sel.start,
        siteTypes: selectedTypes.length ? selectedTypes : undefined,
      });
      const note =
        mode === "local"
          ? "Watch created. Notifications need a development build; this device is using a local token."
          : "Watch created. You will get a push when a site opens.";
      if (Platform.OS === "web") console.log(note);
      else Alert.alert("Watching", note);
      router.push("/(tabs)/watches");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create watch";
      if (Platform.OS === "web") console.error(message);
      else Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadMonth("refresh")} />}
    >
      <Stack.Screen options={{ title: typeof name === "string" && name ? name : "Campground" }} />

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={12} disabled={atCurrentMonth}>
          <Text style={[styles.monthArrow, atCurrentMonth && styles.monthArrowDisabled]}>{"<"}</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={12}>
          <Text style={styles.monthArrow}>{">"}</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Tap any day column to set the start, tap a later day to set the end.</Text>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: Colors.available }]} />
        <Text style={styles.legendText}>Available</Text>
        <View style={[styles.dot, { backgroundColor: Colors.reserved }]} />
        <Text style={styles.legendText}>Reserved</Text>
        <View style={[styles.dot, { backgroundColor: Colors.closed }]} />
        <Text style={styles.legendText}>Closed / other</Text>
      </View>

      {loading ? <ActivityIndicator style={styles.spinner} color={Colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data && !loading ? (
        <AvailabilityGrid data={data} selectedStart={sel.start} selectedEnd={sel.end} onPressDate={pressDate} />
      ) : null}

      {siteTypes.length > 1 ? (
        <View>
          <Text style={styles.sectionLabel}>Site types (optional filter)</Text>
          <View style={styles.chips}>
            {siteTypes.map((t) => {
              const active = selectedTypes.includes(t);
              return (
                <Pressable key={t} onPress={() => toggleType(t)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.toLowerCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {openSiteCount !== null ? (
        <Text style={styles.openCount}>
          {openSiteCount > 0
            ? `${openSiteCount} site${openSiteCount === 1 ? "" : "s"} open right now for your dates — book on Recreation.gov, no watch needed.`
            : "Nothing open for those dates right now. Set a watch and get pinged the moment a site frees up."}
        </Text>
      ) : null}

      <Pressable style={[styles.watchButton, !canWatch && styles.watchDisabled]} onPress={watch} disabled={!canWatch}>
        <Text style={styles.watchText}>
          {sel.start ? `Watch ${shortDate(sel.start)} to ${shortDate(sel.end ?? sel.start)}` : "Select dates to watch"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg },
  monthArrow: { fontSize: 22, color: Colors.accent, fontWeight: "700", paddingHorizontal: Spacing.md },
  monthArrowDisabled: { opacity: 0.25 },
  monthLabel: { fontSize: 17, fontWeight: "700", color: Colors.text, minWidth: 110, textAlign: "center" },
  hint: { color: Colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: Spacing.sm },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginVertical: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 3, marginLeft: 8 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
  spinner: { marginTop: Spacing.lg },
  error: { color: Colors.danger, textAlign: "center", margin: Spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: Colors.accent },
  chipText: { fontSize: 12, color: Colors.text },
  chipTextActive: { color: "#fff" },
  openCount: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: Spacing.lg, textAlign: "center" },
  watchButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  watchDisabled: { opacity: 0.4 },
  watchText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
