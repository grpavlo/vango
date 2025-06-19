import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';

export default function SettingsScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <AppButton title="Вийти" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
});
