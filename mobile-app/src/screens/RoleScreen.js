import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';

export default function RoleScreen() {
  const { selectRole } = useAuth();

  async function choose(r) {
    await selectRole(r);
  }

  return (
    <View style={styles.container}>
      <AppButton title="Я водій" onPress={() => choose('DRIVER')} />
      <AppButton title="Я замовник" onPress={() => choose('CUSTOMER')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
});
