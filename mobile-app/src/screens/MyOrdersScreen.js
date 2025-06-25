import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import AppButton from '../components/AppButton';
import { apiFetch, HOST_URL } from '../api';
import { useAuth } from '../AuthContext';
import OrderCardSkeleton from '../components/OrderCardSkeleton';

export default function MyOrdersScreen({ navigation }) {
  const { token, role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef(null);
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

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [role, navigation]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  function connectWs() {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();
    const url = `${HOST_URL.replace(/^http/, 'ws')}/api/orders/stream`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = () => load();
    ws.onerror = (e) => console.log('ws error', e.message);
  }
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
          {role === 'DRIVER' && item.customer && (
            <View style={styles.driverBlock}>
              <View style={styles.driverRow}>
                <Ionicons name="person-circle" size={36} color={colors.green} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text>{item.customer.name}</Text>
                </View>
                {item.customer.phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                    <Ionicons name="call" size={28} color={colors.green} />
                  </TouchableOpacity>
                )}
              </View>
              {reserved && (
                <>
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
                </>
              )}
            </View>
          )}
          {role === 'CUSTOMER' && (item.driver || item.reservedDriver || item.candidateDriver) && (
            <View style={styles.driverBlock}>
              <View style={styles.driverRow}>
                <Ionicons name="person-circle" size={36} color={colors.green} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text>{(item.driver || item.reservedDriver || item.candidateDriver).name}</Text>
                  {(item.driver || item.reservedDriver || item.candidateDriver).rating && (
                    <Text>Рейтинг: {(item.driver || item.reservedDriver || item.candidateDriver).rating.toFixed(1)}</Text>
                  )}
                </View>
                {(item.driver || item.reservedDriver || item.candidateDriver).phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${(item.driver || item.reservedDriver || item.candidateDriver).phone}`)}>
                    <Ionicons name="call" size={28} color={colors.green} />
                  </TouchableOpacity>
                )}
              </View>
              {reserved && (
                <Text style={styles.timerText}>
                  {Math.ceil((new Date(item.reservedUntil) - now) / 60000)} хв
                </Text>
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
    const reservedActive = o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date();
    if (filter === 'active') {
      if (role === 'DRIVER') {
        return ['ACCEPTED', 'IN_PROGRESS'].includes(o.status);
      }
      return (
        ['ACCEPTED', 'IN_PROGRESS', 'PENDING'].includes(o.status) || reservedActive
      );
    }
    if (filter === 'posted') {
      if (role === 'DRIVER') {
        return reservedActive || o.status === 'PENDING';
      }
      return o.status === 'CREATED' && !o.reservedBy;
    }
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
          <Text style={filter === 'posted' ? styles.activeFilterText : null}>
            {role === 'DRIVER' ? 'На підтвердженні' : 'Мої'}
          </Text>
        </Pressable>
        <Pressable style={[styles.filterBtn, filter === 'history' && styles.activeFilter]} onPress={() => setFilter('history')}>
          <Text style={filter === 'history' ? styles.activeFilterText : null}>Історія</Text>
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(o) => o.id.toString()}
        onRefresh={refresh}
        refreshing={refreshing}
      />
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
