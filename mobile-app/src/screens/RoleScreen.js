import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../AuthContext';
import RoleSwitch from '../components/RoleSwitch';

export default function RoleScreen() {
  const { selectRole } = useAuth();

  async function choose(r) {
    await selectRole(r, true); // перший вибір ролі після реєстрації — показати профіль
  }

  return (
    <View style={styles.container}>
      <RoleSwitch value={null} onChange={choose} style={styles.switch} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  switch: { width: '80%' },
});
