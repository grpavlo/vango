import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';
import RoleSwitch from '../components/RoleSwitch';

export default function SettingsScreen() {
  const { logout, role, selectRole } = useAuth();

  function handleChange(r) {
    if (r !== role) selectRole(r);
  }

  return (
    <View style={styles.container}>
      <RoleSwitch value={role} onChange={handleChange} style={styles.switch} />
      <AppButton title="Вийти" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  switch: { marginBottom: 24 },

});
