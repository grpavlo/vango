import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
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

  function renderItem({ item }) {
    const pickup = item.pickupLocation || [item.pickupCity, item.pickupAddress].filter(Boolean).join(', ');
    const dropoff = item.dropoffLocation || [item.dropoffCity, item.dropoffAddress].filter(Boolean).join(', ');
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <View style={styles.item}>
          <Text style={styles.route}>
            {pickup} ➔ {dropoff}
          </Text>
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
});
