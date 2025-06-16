import React from 'react';
import { View, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation, route }) {
  const { token } = route.params;
  return (
    <View style={styles.container}>
      <Button title="Orders" onPress={() => navigation.navigate('Orders', { token })} />
      <Button title="Create Order" onPress={() => navigation.navigate('CreateOrder', { token })} />
      <Button title="Balance" onPress={() => navigation.navigate('Balance', { token })} />
      <Button title="Admin" onPress={() => navigation.navigate('Admin', { token })} />
      <Button title="Analytics" onPress={() => navigation.navigate('Analytics', { token })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 12, padding: 16 }
});
