import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';
import RoleSwitch from '../components/RoleSwitch';
import AppText from '../components/AppText';
import { apiFetch } from '../api';
import ListItem from '../components/ListItem';
import { colors } from '../components/Colors';

export default function SettingsScreen() {
  const { logout, role, selectRole, token } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const me = await apiFetch('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me);
      } catch {}
    }
    load();
  }, [token]);

  function handleChange(r) {
    if (r !== role) selectRole(r);
  }

  return (
    <View style={styles.container}>
      {user && (
        <View style={styles.userInfo}>
          <AppText style={styles.name}>{user.name}</AppText>
          <AppText style={styles.phone}>{user.phone}</AppText>
        </View>
      )}
      <AppText style={styles.subtitle}>
        Дозвольте мені більше про вас дізнатись.
      </AppText>
      <View style={styles.list}>
        <ListItem title="Профіль користувача" onPress={() => {}} />
        <ListItem title="Мова" onPress={() => {}} />
        <ListItem title="Тема">
          <RoleSwitch value={role} onChange={handleChange} />
        </ListItem>
      </View>
      <AppButton title="Вийти" onPress={logout} style={styles.logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  phone: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  logout: {
    marginTop: 'auto',
  },
});
