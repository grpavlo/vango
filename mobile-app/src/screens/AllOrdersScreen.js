import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AllOrdersScreen() {
  return (
    <View style={styles.container}>
      <Text>Всі замовлення</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
