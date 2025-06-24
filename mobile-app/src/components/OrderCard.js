import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { colors } from './Colors';

export default function OrderCard({ order, onPress }) {
  const pickupCity = order.pickupCity || ((order.pickupLocation || '').split(',')[1] || '').trim();
  const dropoffCity = order.dropoffCity || ((order.dropoffLocation || '').split(',')[1] || '').trim();
  const volume = calcVolume(order.dimensions);

  let region;
  const pLat = order.pickupLat;
  const pLon = order.pickupLon;
  const dLat = order.dropoffLat;
  const dLon = order.dropoffLon;

  if (pLat && pLon && dLat && dLon) {
    const midLat = (pLat + dLat) / 2;
    const midLon = (pLon + dLon) / 2;
    const latDelta = Math.max(Math.abs(pLat - dLat), 0.01) * 2.5;
    const lonDelta = Math.max(Math.abs(pLon - dLon), 0.01) * 2.5;
    region = { latitude: midLat, longitude: midLon, latitudeDelta: latDelta, longitudeDelta: lonDelta };
  } else {
    region = {
      latitude: pLat || dLat || 50.45,
      longitude: pLon || dLon || 30.523,
      latitudeDelta: 0.4,
      longitudeDelta: 0.4,
    };
  }

  return (
    <View style={styles.card}>
      <View style={styles.mapContainer}>
        <MapView style={{ flex: 1 }} initialRegion={region}>

          {order.pickupLat && order.pickupLon && (
            <Marker
              coordinate={{ latitude: order.pickupLat, longitude: order.pickupLon }}
              pinColor={colors.orange}
            />
          )}
          {order.dropoffLat && order.dropoffLon && (
            <Marker
              coordinate={{ latitude: order.dropoffLat, longitude: order.dropoffLon }}
              pinColor={colors.green}
            />
          )}
        </MapView>
      </View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.infoContainer}>
        <Text style={styles.route}>{pickupCity} ➔ {dropoffCity}</Text>
        <Text style={styles.info}>Завантаження: {formatDate(new Date(order.loadFrom))}</Text>
        <Text style={styles.info}>
          Обʼєм: {volume !== null ? volume.toFixed(2) : '?'} м³, Вага: {order.weight} кг
        </Text>
        <Text style={styles.info}>Ціна: {Math.round(order.price)} грн</Text>
        <View style={styles.iconRow}>
          <Ionicons
            name={order.payment === 'card' ? 'card' : 'cash'}
            size={20}
            color={colors.green}
          />
          {order.loadHelp && (
            <Ionicons
              name="arrow-down-circle-outline"
              size={20}
              color={colors.orange}
              style={{ marginLeft: 8 }}
            />
          )}
          {order.unloadHelp && (
            <Ionicons
              name="arrow-up-circle-outline"
              size={20}
              color={colors.orange}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function calcVolume(dimensions) {
  if (!dimensions) return null;
  const parts = dimensions.split('x').map((n) => parseFloat(n));
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  return parts[0] * parts[1] * parts[2];
}

function formatDate(d) {
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 8,
    borderRadius: 8,
    elevation: 2,
  },
  mapContainer: { height: 120, borderRadius: 8, overflow: 'hidden' },
  infoContainer: { paddingVertical: 4 },
  route: { fontWeight: 'bold', marginTop: 8 },
  info: { marginTop: 2, color: '#333' },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
