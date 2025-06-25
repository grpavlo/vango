import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import AppButton from '../components/AppButton';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import OrderCardSkeleton from '../components/OrderCardSkeleton';
import Skeleton from '../components/Skeleton';

export default function MyOrdersScreen({ navigation }) {
  const { token, role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active');

  async function load() {
    try {
      setLoading(true);
      const url = role ? `/orders/my?role=${role}` : '/orders/my';
      const data = await apiFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(data);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [role, navigation]);

  async function cancelReserve(id) {
    try {
      await apiFetch(`/orders/${id}/cancel-reserve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmDriver(id) {
    try {
      await apiFetch(`/orders/${id}/confirm-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  async function rejectDriver(id) {
    try {
      await apiFetch(`/orders/${id}/reject-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (err) {
      console.log(err);
    }
  }

  function renderItem({ item }) {
    const pickupCity = item.pickupCity || ((item.pickupLocation || '').split(',')[1] || '').trim();
    const dropoffCity = item.dropoffCity || ((item.dropoffLocation || '').split(',')[1] || '').trim();
    const dropoffAddress = item.dropoffAddress || ((item.dropoffLocation || '').split(',')[0] || '').trim();
    const now = new Date();
    const reserved = item.reservedBy && item.reservedUntil && new Date(item.reservedUntil) > now;
    const pending = item.status === 'PENDING';
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <View style={[styles.item, reserved && styles.reservedItem]}>
          {reserved && item.reservedDriver && (
            <View style={styles.driverBlock}>
              <View style={styles.driverRow}>
                <Ionicons name="person-circle" size={36} color={colors.green} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text>{item.reservedDriver.name}</Text>
                  <Text>⭐ {item.reservedDriver.rating?.toFixed(1)}</Text>
                </View>
                {item.reservedDriver.phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.reservedDriver.phone}`)}>
                    <Ionicons name="call" size={28} color={colors.green} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.timerText}>
                {Math.ceil((new Date(item.reservedUntil) - now) / 60000)} хв
              </Text>
              {!pending && (
                <AppButton
                  title="Відмінити резерв"
                  onPress={() => cancelReserve(item.id)}
                  style={{ marginTop: 4 }}
                />
              )}
              {pending && item.candidateDriver && (
                <View style={styles.pendingRow}>
                  <AppButton
                    title="Підтвердити"
                    onPress={() => confirmDriver(item.id)}
                    style={{ flex: 1, marginRight: 4 }}
                  />
                  <AppButton
                    title="Відхилити"
                    color="red"
                    onPress={() => rejectDriver(item.id)}
                    style={{ flex: 1, marginLeft: 4 }}
                  />
                </View>
              )}
            </View>
          )}
          <Text style={styles.itemNumber}>№ {item.id}</Text>
          <Text style={styles.itemText}>Місто завантаження: {pickupCity}</Text>
          <Text style={styles.itemText}>Місто розвантаження: {dropoffCity}</Text>
          <Text style={styles.itemText}>Адреса розвантаження: {dropoffAddress}</Text>
          <Text style={styles.itemText}>Дата створення: {new Date(item.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.itemText}>Ціна: {Math.round(item.price)} грн</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const filtered = orders.filter((o) => {
    if (filter === 'active') {
      return (
        ['ACCEPTED', 'IN_PROGRESS', 'PENDING'].includes(o.status) ||
        (o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date())
      );
    }
    if (filter === 'posted') return o.status === 'CREATED' && !o.reservedBy;
    return ['DELIVERED', 'COMPLETED'].includes(o.status) || o.status === 'CANCELLED';
  });

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {[...Array(5)].map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filters}>
        <Pressable style={[styles.filterBtn, filter === 'active' && styles.activeFilter]} onPress={() => setFilter('active')}>
          <Text style={filter === 'active' ? styles.activeFilterText : null}>В роботі</Text>
        </Pressable>
        <Pressable style={[styles.filterBtn, filter === 'posted' && styles.activeFilter]} onPress={() => setFilter('posted')}>
          <Text style={filter === 'posted' ? styles.activeFilterText : null}>Мої</Text>
        </Pressable>
        <Pressable style={[styles.filterBtn, filter === 'history' && styles.activeFilter]} onPress={() => setFilter('history')}>
          <Text style={filter === 'history' ? styles.activeFilterText : null}>Історія</Text>
        </Pressable>
      </View>
      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(o) => o.id.toString()} />
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
  itemNumber: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  itemText: { color: '#333', marginTop: 2 },
  filters: { flexDirection: 'row', justifyContent: 'space-around', margin: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  activeFilter: { backgroundColor: '#333' },
  activeFilterText: { color: '#fff' },
  reservedItem: { borderColor: colors.orange, borderWidth: 2 },
  driverBlock: { marginBottom: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  timerText: { textAlign: 'right', color: colors.orange },
  pendingRow: { flexDirection: 'row', marginTop: 4 },
});
