import React, { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MonthAvailability, SiteRow } from "../api/types";
import { dayOfMonth, todayISO } from "../lib/dates";
import { Colors, isBookable, statusColor } from "../lib/theme";

const CELL = 30;
const GAP = 2;
const PITCH = CELL + GAP;
const HEADER_H = 40;
const SITE_COL = 96;
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

const HeaderRow = memo(function HeaderRow({
  dates,
  today,
  selectedStart,
  selectedEnd,
  onPressDate,
}: {
  dates: string[];
  today: string;
  selectedStart: string | null;
  selectedEnd: string | null;
  onPressDate: (date: string) => void;
}) {
  return (
    <View style={styles.row}>
      {dates.map((d) => {
        const selected = inRange(d, selectedStart, selectedEnd);
        const past = d < today;
        const dow = dayOfWeek(d);
        const weekend = dow === 0 || dow === 6;
        const textStyles = [
          weekend && styles.weekendText,
          selected && styles.headerTextSelected,
          past && styles.pastText,
        ];
        return (
          <Pressable
            key={d}
            disabled={past}
            onPress={() => onPressDate(d)}
            style={[styles.col, styles.headerCell, selected && styles.headerSelected]}
          >
            <Text style={[styles.dowText, ...textStyles]}>{DOW[dow]}</Text>
            <Text style={[styles.headerText, ...textStyles]}>{dayOfMonth(d)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// Selection is drawn as an overlay, so rows never re-render on tap.
const GridRow = memo(function GridRow({
  site,
  dates,
  today,
  onPressDate,
}: {
  site: SiteRow;
  dates: string[];
  today: string;
  onPressDate: (date: string) => void;
}) {
  return (
    <View style={styles.row}>
      {dates.map((d) => (
        <Pressable
          key={d}
          disabled={d < today}
          onPress={() => onPressDate(d)}
          style={[styles.col, styles.cell, { backgroundColor: statusColor(site.days[d]) }, d < today && styles.pastCell]}
        />
      ))}
    </View>
  );
});

export function AvailabilityGrid({ data, selectedStart, selectedEnd, onPressDate }: Props) {
  const today = todayISO();

  const nights = useMemo(
    () => (selectedStart ? data.dates.filter((d) => inRange(d, selectedStart, selectedEnd)) : []),
    [data.dates, selectedStart, selectedEnd],
  );

  // Sites open for the whole selected range float to the top (stable sort
  // keeps name order within each group).
  const sortedSites = useMemo(() => {
    if (nights.length === 0) return data.sites;
    const open = (s: SiteRow) => nights.every((d) => isBookable(s.days[d]));
    return [...data.sites].sort((a, b) => Number(open(b)) - Number(open(a)));
  }, [data.sites, nights]);

  const selection = useMemo(() => {
    let first = -1;
    let last = -1;
    data.dates.forEach((d, i) => {
      if (inRange(d, selectedStart, selectedEnd)) {
        if (first === -1) first = i;
        last = i;
      }
    });
    return first === -1 ? null : { first, last };
  }, [data.dates, selectedStart, selectedEnd]);

  if (data.sites.length === 0) {
    return <Text style={styles.empty}>No campsites reported for this month.</Text>;
  }

  return (
    <View style={styles.row}>
      <View>
        <View style={[styles.headerCell, { width: SITE_COL, alignItems: "flex-start" }]}>
          <Text style={styles.headerText}>Site</Text>
        </View>
        {sortedSites.map((s) => (
          <View key={s.campsiteId} style={[styles.siteCell, { width: SITE_COL }]}>
            <Text style={styles.siteText} numberOfLines={1}>
              {s.site}
            </Text>
            {s.loop ? (
              <Text style={styles.loopText} numberOfLines={1}>
                {s.loop}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <HeaderRow
            dates={data.dates}
            today={today}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            onPressDate={onPressDate}
          />
          <View>
            {sortedSites.map((s) => (
              <GridRow key={s.campsiteId} site={s} dates={data.dates} today={today} onPressDate={onPressDate} />
            ))}
            {selection ? (
              <View
                pointerEvents="none"
                style={[
                  styles.selectionOverlay,
                  {
                    left: selection.first * PITCH - 1,
                    width: (selection.last - selection.first + 1) * PITCH - GAP + 2,
                    height: sortedSites.length * PITCH - GAP + 2,
                  },
                ]}
              />
            ) : null}
          </View>
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
  siteText: { fontSize: 11, fontWeight: "600", color: Colors.text },
  loopText: { fontSize: 9, color: Colors.textSecondary },
  cell: { height: CELL, marginBottom: GAP, borderRadius: 4 },
  pastCell: { opacity: 0.35 },
  selectionOverlay: {
    position: "absolute",
    top: -1,
    borderWidth: 2,
    borderColor: Colors.selected,
    borderRadius: 6,
    backgroundColor: "rgba(31, 110, 67, 0.10)",
  },
  empty: { color: Colors.textSecondary, padding: 16 },
});
