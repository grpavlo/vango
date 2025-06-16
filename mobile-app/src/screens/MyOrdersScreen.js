import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { apiFetch } from '../api';

export default function MyOrdersScreen({ route, navigation }) {
  const { token } = route.params;
  const [orders, setOrders] = useState([]);

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

  return (
    <View style={styles.container}>
      <FlatList data={orders} renderItem={renderItem} keyExtractor={o => o.id.toString()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { padding: 12, borderBottomWidth: 1 }
});
