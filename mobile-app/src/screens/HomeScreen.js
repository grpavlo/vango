import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useAuth } from '../AuthContext';

export default function HomeScreen({ navigation }) {
  const { token } = useAuth();
  return (
    <View style={styles.container}>
      <Button title="Orders" onPress={() => navigation.navigate('Orders', { token })} />
      <Button title="Create Order" onPress={() => navigation.navigate('CreateOrder', { token })} />
      <Button title="Balance" onPress={() => navigation.navigate('Balance', { token })} />
      <Button title="Admin" onPress={() => navigation.navigate('Admin', { token })} />
      <Button title="Analytics" onPress={() => navigation.navigate('Analytics', { token })} />
      <Button title="Favorites" onPress={() => navigation.navigate('Favorites', { token })} />
      <Button title="My Orders" onPress={() => navigation.navigate('MyOrders', { token })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12, padding: 16 }
});
