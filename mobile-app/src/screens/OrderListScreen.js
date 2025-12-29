import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import OrderCardSkeleton from '../components/OrderCardSkeleton';

export default function OrderListScreen({ navigation }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch('/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(data.available);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setLoading(false);
      }
    }
    load();
  }, []);

  function openLocationInMaps(address, lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const hasCoords =
      lat !== undefined &&
      lat !== null &&
      lon !== undefined &&
      lon !== null &&
      `${lat}` !== '' &&
      `${lon}` !== '' &&
      Number.isFinite(latNum) &&
      Number.isFinite(lonNum);
    const query = address || (hasCoords ? `${latNum},${lonNum}` : '');
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const coord = hasCoords ? `${latNum},${lonNum}` : null;
    const url = coord
      ? Platform.select({
          ios: `http://maps.apple.com/?ll=${coord}&q=${encoded}`,
          default: `geo:${coord}?q=${encoded}`,
        })
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch((err) => console.log('maps open error', err));
  }

  function renderItem({ item }) {
    const pickup = item.pickupLocation || [item.pickupCity, item.pickupAddress].filter(Boolean).join(', ');
    const dropoff = item.dropoffLocation || [item.dropoffCity, item.dropoffAddress].filter(Boolean).join(', ');
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <View style={styles.item}>
          <Text style={styles.route}>
            {pickup} ➔ {dropoff}
          </Text>
          <View style={styles.mapRow}>
            <TouchableOpacity
              style={styles.mapChip}
              activeOpacity={0.8}
              onPress={() => openLocationInMaps(pickup, item.pickupLat, item.pickupLon)}
            >
              <Ionicons name="navigate-outline" size={18} color="#f97316" />
              <Text style={styles.mapChipText}>Відкрити точку A</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapChip}
              activeOpacity={0.8}
              onPress={() => openLocationInMaps(dropoff, item.dropoffLat, item.dropoffLon)}
            >
              <Ionicons name="navigate-outline" size={18} color="#16a34a" />
              <Text style={styles.mapChipText}>Відкрити точку B</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {Array.from({ length: 5 }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList data={orders} renderItem={renderItem} keyExtractor={o => o.id.toString()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12 },
  item: {
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  route: { fontSize: 16, fontWeight: '500', color: '#333' },
  mapRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
    justifyContent: 'space-between',
  },
  mapChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
  },
  mapChipText: { marginLeft: 6, fontWeight: '600', color: '#111827' },
});
