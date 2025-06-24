import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';

export default function MapSelectScreen({ navigation, route }) {
  const { onSelect, address, lat, lon } = route.params || {};
  const [region, setRegion] = useState({
    latitude: lat ? parseFloat(lat) : 50.4501,
    longitude: lon ? parseFloat(lon) : 30.5234,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [marker, setMarker] = useState(lat && lon ? { latitude: parseFloat(lat), longitude: parseFloat(lon) } : null);

  useEffect(() => {
    async function geocode() {
      if (!marker && address) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=ua`,
            { headers: { 'User-Agent': 'vango-app' } }
          );
          const data = await res.json();
          if (data && data[0]) {
            const la = parseFloat(data[0].lat);
            const lo = parseFloat(data[0].lon);
            setRegion({ latitude: la, longitude: lo, latitudeDelta: 0.05, longitudeDelta: 0.05 });
            setMarker({ latitude: la, longitude: lo });
          }
        } catch {}
      }
    }
    geocode();
  }, []);

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
      <MapView style={{ flex: 1 }} region={region} onPress={(e) => setMarker(e.nativeEvent.coordinate)}>
        {marker && <Marker coordinate={marker} />}
      </MapView>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={32} color="#333" />
      </TouchableOpacity>
      {marker && (
        <AppButton title="Підтвердити" onPress={confirm} style={styles.confirm} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 40, left: 20, backgroundColor: '#fff', borderRadius: 20, padding: 6 },
  confirm: { position: 'absolute', bottom: 40, left: 20, right: 20 },
});
