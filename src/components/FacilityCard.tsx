import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { Facility } from "../api/types";
import { Colors, Spacing } from "../lib/theme";

interface Props {
  facility: Facility;
  onPress: () => void;
}

export function FacilityCard({ facility, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.name}>{facility.name}</Text>
      {facility.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {facility.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pressed: { opacity: 0.7 },
  name: { fontSize: 16, fontWeight: "600", color: Colors.text },
  description: { fontSize: 13, color: Colors.textSecondary, marginTop: Spacing.xs },
});
