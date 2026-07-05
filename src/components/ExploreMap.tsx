import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Facility } from "../api/types";

interface Props {
  facilities: Facility[];
  onSelect: (facility: Facility) => void;
}

export function ExploreMap({ facilities, onSelect }: Props) {
  const located = facilities.filter((f) => f.latitude !== null && f.longitude !== null);
  const first = located[0];
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: first?.latitude ?? 39.5,
        longitude: first?.longitude ?? -98.35,
        latitudeDelta: first ? 2 : 30,
        longitudeDelta: first ? 2 : 30,
      }}
    >
      {located.map((f) => (
        <Marker
          key={f.id}
          coordinate={{ latitude: f.latitude as number, longitude: f.longitude as number }}
          title={f.name}
          onCalloutPress={() => onSelect(f)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
