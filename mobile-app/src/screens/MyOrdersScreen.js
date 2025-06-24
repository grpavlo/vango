import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function MyOrdersScreen({ navigation }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/orders/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(data);
      } catch (err) {
        console.log(err);
      }
    }
    load();
  }, []);

  function renderItem({ item }) {
    const pickupParts = (item.pickupLocation || '').split(',');
    const dropoffParts = (item.dropoffLocation || '').split(',');
    const pickupCity = pickupParts.length > 1 ? pickupParts[1].trim() : pickupParts[0];
    const dropoffCity = dropoffParts.length > 1 ? dropoffParts[1].trim() : dropoffParts[0];
    const dropoffAddress = dropoffParts[0] ? dropoffParts[0].trim() : '';
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
    if (filter === 'active') return ['ACCEPTED', 'IN_PROGRESS'].includes(o.status);
    if (filter === 'posted') return o.status === 'CREATED';
    return ['DELIVERED', 'COMPLETED'].includes(o.status) || o.status === 'CANCELLED';
  });

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
