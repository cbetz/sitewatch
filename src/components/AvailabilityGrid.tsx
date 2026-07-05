import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MonthAvailability } from "../api/types";
import { dayOfMonth, todayISO } from "../lib/dates";
import { Colors, statusColor } from "../lib/theme";

const CELL = 30;
const GAP = 2;
const HEADER_H = 40;
const SITE_COL = 88;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  data: MonthAvailability;
  selectedStart: string | null;
  selectedEnd: string | null;
  onPressDate: (date: string) => void;
}

function inRange(date: string, start: string | null, end: string | null): boolean {
  if (!start) return false;
  if (!end) return date === start;
  return date >= start && date <= end;
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function AvailabilityGrid({ data, selectedStart, selectedEnd, onPressDate }: Props) {
  const today = todayISO();
  if (data.sites.length === 0) {
    return <Text style={styles.empty}>No campsites reported for this month.</Text>;
  }
  return (
    <View style={styles.row}>
      <View>
        <View style={[styles.headerCell, { width: SITE_COL, alignItems: "flex-start" }]}>
          <Text style={styles.headerText}>Site</Text>
        </View>
        {data.sites.map((s) => (
          <View key={s.campsiteId} style={[styles.siteCell, { width: SITE_COL }]}>
            <Text style={styles.siteText} numberOfLines={1}>
              {s.site}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.row}>
            {data.dates.map((d) => {
              const selected = inRange(d, selectedStart, selectedEnd);
              const past = d < today;
              const dow = dayOfWeek(d);
              const weekend = dow === 0 || dow === 6;
              return (
                <Pressable
                  key={d}
                  disabled={past}
                  onPress={() => onPressDate(d)}
                  style={[styles.col, styles.headerCell, selected && styles.headerSelected]}
                >
                  <Text
                    style={[
                      styles.dowText,
                      weekend && styles.weekendText,
                      selected && styles.headerTextSelected,
                      past && styles.pastText,
                    ]}
                  >
                    {DOW[dow]}
                  </Text>
                  <Text
                    style={[
                      styles.headerText,
                      weekend && styles.weekendText,
                      selected && styles.headerTextSelected,
                      past && styles.pastText,
                    ]}
                  >
                    {dayOfMonth(d)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {data.sites.map((s) => (
            <View key={s.campsiteId} style={styles.row}>
              {data.dates.map((d) => {
                const selected = inRange(d, selectedStart, selectedEnd);
                const past = d < today;
                return (
                  <Pressable
                    key={d}
                    disabled={past}
                    onPress={() => onPressDate(d)}
                    style={[
                      styles.col,
                      styles.cell,
                      { backgroundColor: statusColor(s.days[d]) },
                      selected && styles.cellSelected,
                      past && styles.pastCell,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  // One shared column box for header and cells keeps every row in lockstep.
  col: { width: CELL, marginRight: GAP },
  headerCell: { height: HEADER_H, alignItems: "center", justifyContent: "center", borderRadius: 6, marginBottom: GAP },
  headerSelected: { backgroundColor: Colors.selected },
  dowText: { fontSize: 9, color: Colors.textSecondary, fontWeight: "600" },
  headerText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "700" },
  weekendText: { color: Colors.accent },
  headerTextSelected: { color: "#fff" },
  pastText: { opacity: 0.35 },
  siteCell: { height: CELL + GAP, justifyContent: "center", paddingRight: 6 },
  siteText: { fontSize: 12, color: Colors.text },
  cell: { height: CELL, marginBottom: GAP, borderRadius: 4 },
  cellSelected: { borderWidth: 2, borderColor: Colors.selected },
  pastCell: { opacity: 0.35 },
  empty: { color: Colors.textSecondary, padding: 16 },
});
