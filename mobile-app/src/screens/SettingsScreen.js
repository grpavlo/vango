import React from 'react';
import { View, StyleSheet, Text, Switch } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';

export default function SettingsScreen() {
  const { logout, role, selectRole } = useAuth();
  const isCustomer = role === 'CUSTOMER';

  function toggleRole() {
    selectRole(isCustomer ? 'DRIVER' : 'CUSTOMER');
  }

  return (
    <View style={styles.container}>
      <View style={styles.switchRow}>
        <Text style={styles.label}>Замовник</Text>
        <Switch
          value={!isCustomer}
          onValueChange={toggleRole}
          trackColor={{ false: '#ccc', true: '#6abf69' }}
          thumbColor="#fff"
        />
        <Text style={styles.label}>Водій</Text>
      </View>
      <AppButton title="Вийти" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  label: { fontSize: 16 },
});
