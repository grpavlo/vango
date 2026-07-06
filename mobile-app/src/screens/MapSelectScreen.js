import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import AppMap from '../components/AppMap';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import AppButton from '../components/AppButton';
import { getCallback, unregisterCallback } from '../callbackRegistry';

const DEFAULT_COORDS = { latitude: 50.4501, longitude: 30.5234 };
const DEFAULT_DELTA = 0.05;
const LOCATION_STORAGE_KEYS = ['userLocation', 'location'];

function toCoords(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function toRegion(coords) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };
}

function parseStoredCoords(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return toCoords(parsed?.latitude, parsed?.longitude);
  } catch {
    return null;
  }
}

async function getCachedUserCoords() {
  for (const key of LOCATION_STORAGE_KEYS) {
    const stored = await AsyncStorage.getItem(key);
    const coords = parseStoredCoords(stored);
    if (coords) return coords;
  }
  return null;
}

async function storeUserCoords(coords) {
  const value = JSON.stringify(coords);
  await Promise.all(
    LOCATION_STORAGE_KEYS.map((key) => AsyncStorage.setItem(key, value))
  );
}

export default function MapSelectScreen({ navigation, route }) {
  const { onSelectId, onCloseId, address, lat, lon, userLat, userLon } =
    route.params || {};
  const onSelect = getCallback(onSelectId);
  const onClose = getCallback(onCloseId);
  const addressText = String(address || '').trim();
  const selectedCoords = toCoords(lat, lon);
  const initialUserCoords = toCoords(userLat, userLon);
  const [region, setRegion] = useState(() =>
    toRegion(selectedCoords || initialUserCoords || DEFAULT_COORDS)
  );
  const [marker, setMarker] = useState(selectedCoords);
  const mapRef = useRef(null);

  function moveToCoords(coords) {
    const nextRegion = toRegion(coords);
    setRegion(nextRegion);
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(nextRegion, 500);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function centerOnUser() {
      if (selectedCoords || addressText) return;

      try {
        if (!initialUserCoords) {
          const cached = await getCachedUserCoords();
          if (cached && mounted) {
            moveToCoords(cached);
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        const coords = toCoords(loc?.coords?.latitude, loc?.coords?.longitude);
        if (!coords) return;

        await storeUserCoords(coords);
        if (mounted) {
          moveToCoords(coords);
        }
      } catch {
        // Keep the default region if location is unavailable.
      }
    }

    centerOnUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function geocode() {
      if (!marker && addressText) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              addressText
            )}&format=json&limit=1&countrycodes=ua`,
            { headers: { 'User-Agent': 'vango-app' } }
          );
          const data = await res.json();
          if (data && data[0]) {
            const la = parseFloat(data[0].lat);
            const lo = parseFloat(data[0].lon);
            const newRegion = {
              latitude: la,
              longitude: lo,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
            setRegion(newRegion);
            if (mapRef.current?.animateToRegion) {
              mapRef.current.animateToRegion(newRegion, 500);
            }
            setMarker({ latitude: la, longitude: lo });
          }
        } catch {}
      }
    }
    geocode();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      try {
        if (onClose) onClose();
      } finally {
        unregisterCallback(onSelectId);
        unregisterCallback(onCloseId);
      }
    });
    return unsubscribe;
  }, [navigation, onClose, onCloseId, onSelectId]);

  async function confirm() {
    if (onSelect && marker) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${marker.latitude}&lon=${marker.longitude}&format=json&addressdetails=1`,
          { headers: { 'User-Agent': 'vango-app' } }
        );
        const data = await res.json();
        const text = data.display_name || '';
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.state || '';
        const shortAddress = [addr.road, addr.house_number]
          .filter(Boolean)
          .join(' ');
        onSelect({
          lat: marker.latitude,
          lon: marker.longitude,
          text,
          city,
          address: shortAddress,
          country: addr.country || '',
          postcode: addr.postcode || '',
        });
      } catch {
        onSelect({ lat: marker.latitude, lon: marker.longitude });
      }
    }
    navigation.goBack();
  }

  return (
    <View style={{ flex: 1 }}>
      <AppMap
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={(e) => setMarker(e.nativeEvent.coordinate)}
      >
        {marker && <Marker coordinate={marker} />}
      </AppMap>
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={32} color="#333" />
      </TouchableOpacity>
      {marker && (
        <AppButton
          title="Підтвердити"
          onPress={confirm}
          style={styles.confirm}
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
  },
  confirm: { position: 'absolute', bottom: 40, left: 20, right: 20 },
});
