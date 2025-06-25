import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable, SafeAreaView } from 'react-native';
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

  function renderItem({ item }) {
    const pickupCity = item.pickupCity || ((item.pickupLocation || '').split(',')[1] || '').trim();
    const dropoffCity = item.dropoffCity || ((item.dropoffLocation || '').split(',')[1] || '').trim();
    const dropoffAddress = item.dropoffAddress || ((item.dropoffLocation || '').split(',')[0] || '').trim();
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <View style={styles.item}>
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
        ['ACCEPTED', 'IN_PROGRESS'].includes(o.status) ||
        (o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > new Date())
      );
    }
    if (filter === 'posted') return o.status === 'CREATED' && !o.reservedBy;
    return ['DELIVERED', 'COMPLETED'].includes(o.status) || o.status === 'CANCELLED';
  });

  if (loading && orders.length === 0) {
    return (
      <View style={styles.container}>
        {[...Array(5)].map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
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
  activeFilterText: { color: '#fff' }
});
