import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchFacilities } from "../../api/server";
import type { Facility } from "../../api/types";
import { ExploreMap } from "../../components/ExploreMap";
import { FacilityCard } from "../../components/FacilityCard";
import { Colors, Spacing } from "../../lib/theme";

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [results, setResults] = useState<Facility[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchFacilities(query.trim(), state.trim() || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function open(f: Facility) {
    router.push({ pathname: "/campground/[id]", params: { id: f.id, name: f.name } });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.queryInput]}
          placeholder="Campground name (e.g. Upper Pines)"
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, styles.stateInput]}
          placeholder="ST"
          placeholderTextColor={Colors.textSecondary}
          value={state}
          onChangeText={(t) => setState(t.toUpperCase().slice(0, 2))}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable style={styles.searchButton} onPress={runSearch}>
          <Text style={styles.searchButtonText}>Go</Text>
        </Pressable>
      </View>

      {results && results.length > 0 ? (
        <Pressable style={styles.toggle} onPress={() => setShowMap((v) => !v)}>
          <Text style={styles.toggleText}>{showMap ? "Show list" : "Show map"}</Text>
        </Pressable>
      ) : null}

      {loading ? <ActivityIndicator style={styles.spinner} color={Colors.accent} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && results && results.length === 0 ? (
        <Text style={styles.hint}>No reservable campgrounds found. Try a broader name or different state.</Text>
      ) : null}

      {!loading && results && results.length > 0 ? (
        showMap ? (
          <ExploreMap facilities={results} onSelect={open} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(f) => f.id}
            renderItem={({ item }) => <FacilityCard facility={item} onPress={() => open(item)} />}
          />
        )
      ) : null}

      {!loading && results === null && !error ? (
        <Text style={styles.hint}>
          Search Recreation.gov campgrounds, open one to see live availability, then watch your dates to get
          notified when a site opens.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  searchRow: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    height: 42,
    color: Colors.text,
  },
  queryInput: { flex: 1 },
  stateInput: { width: 52, textAlign: "center" },
  searchButton: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  searchButtonText: { color: "#fff", fontWeight: "600" },
  toggle: { alignSelf: "center", marginBottom: Spacing.sm },
  toggleText: { color: Colors.accent, fontWeight: "600" },
  spinner: { marginTop: Spacing.lg },
  error: { color: Colors.danger, textAlign: "center", margin: Spacing.md },
  hint: { color: Colors.textSecondary, textAlign: "center", margin: Spacing.lg, lineHeight: 20 },
});
