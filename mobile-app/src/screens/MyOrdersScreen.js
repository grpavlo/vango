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
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <View style={styles.item}>
          <Text>{item.pickupLocation} -> {item.dropoffLocation} ({item.status})</Text>
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
  item: { padding: 12, borderBottomWidth: 1 },
  filters: { flexDirection: 'row', justifyContent: 'space-around', margin: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  activeFilter: { backgroundColor: '#333' },
  activeFilterText: { color: '#fff' }
});
