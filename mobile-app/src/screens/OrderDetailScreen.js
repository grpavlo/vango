import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';

export default function OrderDetailScreen({ route, navigation }) {
  const { order, token } = route.params;

  async function accept() {
    try {
      await apiFetch(`/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      navigation.navigate('Orders', { token });
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <View style={styles.container}>
      <Text>Pickup: {order.pickupLocation}</Text>
      <Text>Dropoff: {order.dropoffLocation}</Text>
      <Text>Price: {order.price}</Text>
      <Button title="Accept" onPress={accept} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 }
});
