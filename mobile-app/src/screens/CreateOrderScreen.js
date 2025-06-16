import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';

export default function CreateOrderScreen({ route, navigation }) {
  const { token } = route.params;
  const [pickupLocation, setPickup] = useState('');
  const [dropoffLocation, setDropoff] = useState('');
  const [price, setPrice] = useState('');

  async function create() {
    try {
      await apiFetch('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pickupLocation, dropoffLocation, price })
      });
      navigation.navigate('Orders', { token });
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <View style={styles.container}>
      <Text>Pickup location</Text>
      <TextInput style={styles.input} value={pickupLocation} onChangeText={setPickup} />
      <Text>Dropoff location</Text>
      <TextInput style={styles.input} value={dropoffLocation} onChangeText={setDropoff} />
      <Text>Price</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Button title="Create" onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, padding: 8, marginVertical: 4 }
});
