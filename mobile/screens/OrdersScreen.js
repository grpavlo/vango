import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { SERVER_URL } from '../config';

export default function OrdersScreen({ token }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setOrders(json.available || []);
        }
      } catch (err) {
        // ignore
      }
    };
    fetchOrders();
  }, [token]);

  const renderItem = ({ item }) => (
    <View style={{ padding: 8, borderBottomWidth: 1 }}>
      <Text>{item.pickupLocation} ➜ {item.dropoffLocation}</Text>
      <Text>Status: {item.status}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={orders}
        keyExtractor={o => String(o.id)}
        renderItem={renderItem}
      />
    </View>
  );
}
