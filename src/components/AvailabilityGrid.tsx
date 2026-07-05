import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MonthAvailability } from "../api/types";
import { dayOfMonth } from "../lib/dates";
import { Colors, statusColor } from "../lib/theme";

const CELL = 26;
const SITE_COL = 76;

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

export function AvailabilityGrid({ data, selectedStart, selectedEnd, onPressDate }: Props) {
  if (data.sites.length === 0) {
    return <Text style={styles.empty}>No campsites reported for this month.</Text>;
  }
  return (
    <View style={styles.row}>
      <View>
        <View style={[styles.headerCell, { width: SITE_COL }]}>
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
              return (
                <Pressable
                  key={d}
                  onPress={() => onPressDate(d)}
                  style={[styles.headerCell, { width: CELL }, selected && styles.headerSelected]}
                >
                  <Text style={[styles.headerText, selected && styles.headerTextSelected]}>{dayOfMonth(d)}</Text>
                </Pressable>
              );
            })}
          </View>
          {data.sites.map((s) => (
            <View key={s.campsiteId} style={styles.row}>
              {data.dates.map((d) => {
                const selected = inRange(d, selectedStart, selectedEnd);
                return (
                  <View
                    key={d}
                    style={[
                      styles.cell,
                      { width: CELL, backgroundColor: statusColor(s.days[d]) },
                      selected && styles.cellSelected,
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
  headerCell: { height: 30, alignItems: "center", justifyContent: "center" },
  headerSelected: { backgroundColor: Colors.selected, borderRadius: 4 },
  headerText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },
  headerTextSelected: { color: "#fff" },
  siteCell: { height: CELL + 2, justifyContent: "center", paddingRight: 6 },
  siteText: { fontSize: 12, color: Colors.text },
  cell: { height: CELL, margin: 1, borderRadius: 3 },
  cellSelected: { borderWidth: 2, borderColor: Colors.selected },
  empty: { color: Colors.textSecondary, padding: 16 },
});
