import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function OrderListScreen({ navigation }) {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/orders', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(data.available);
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
          <Text>{item.pickupLocation} -> {item.dropoffLocation}</Text>
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
