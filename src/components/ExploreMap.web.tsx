import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Facility } from "../api/types";
import { Colors } from "../lib/theme";

interface Props {
  facilities: Facility[];
  onSelect: (facility: Facility) => void;
}

/** react-native-maps has no web implementation; the web build shows the list instead. */
export function ExploreMap(_props: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Map view is available in the mobile app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: Colors.textSecondary },
});
