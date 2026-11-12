import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../AuthContext';
import AppButton from '../components/AppButton';
import RoleSwitch from '../components/RoleSwitch';

export default function RoleScreen({ navigation }) {
  const { selectRole } = useAuth();

  async function choose(r) {
    try {
      await selectRole(r, true);
    } catch (error) {
      Alert.alert('Не вдалося змінити роль', error.message || 'Спробуйте ще раз');
    }
  }

  return (
    <View style={styles.container}>
      <RoleSwitch value={null} onChange={choose} style={styles.switch} />
      <AppButton title="Видалити акаунт" variant="danger" style={{marginTop: 32}}
        onPress={() => navigation.navigate('DeleteAccount')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  switch: { width: '80%' },
});
