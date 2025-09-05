import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';
import RoleSwitch from '../components/RoleSwitch';
import AppText from '../components/AppText';
import { apiFetch } from '../api';
import ListItem from '../components/ListItem';
import { colors } from '../components/Colors';
import ProfileCardSkeleton from '../components/ProfileCardSkeleton';

export default function SettingsScreen() {
  const { logout, role, selectRole, token } = useAuth();
  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        setLoadingProfile(true);
        const me = await apiFetch('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me);
      } catch {}
      finally {
        setLoadingProfile(false);
      }
    }
    load();
  }, [token]);

  async function handleChange(r) {
    if (r !== role) {
      setLoadingProfile(true);
      await selectRole(r);
      try {
        const me = await apiFetch('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me);
      } catch {}
      setLoadingProfile(false);
    }
  }

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loadingProfile ? (
        <ProfileCardSkeleton />
      ) : (
        user && (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>{initials}</AppText>
            </View>
          <AppText style={styles.name}>{user.name}</AppText>
          <AppText style={styles.phone}>{user.phone}</AppText>

          <View style={styles.roleCard}>
            <View style={styles.badge}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.roleTitle}>
                {role === 'CUSTOMER' ? 'Замовник' : 'Водій'}
              </AppText>
              <AppText style={styles.roleSub}>
                {role === 'CUSTOMER'
                  ? 'Створюйте та керуйте своїми замовленнями.'
                  : 'Приймайте та виконуйте замовлення.'}
              </AppText>
            </View>
            <View style={styles.badgeRight}>
              <Ionicons name="bus" size={20} color={colors.primary500} />
            </View>
          </View>

          <RoleSwitch
            value={role}
            onChange={handleChange}
            style={styles.profileSwitch}
          />

          <AppButton
            title="Вийти"
            onPress={logout}
            style={styles.logoutButton}
          />
        </View>)
      )}

      <View style={styles.list}>
        <ListItem title="Профіль користувача" onPress={() => {}} icon="person" />
        <ListItem title="Мова" onPress={() => {}} icon="globe" />
        <ListItem title="Роль" icon="swap-horizontal">
          <RoleSwitch value={role} onChange={handleChange} />
        </ListItem>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray100,
  },
  content: {
    padding: 24,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  phone: {
    color: colors.gray500,
    marginTop: 4,
    marginBottom: 16,
  },
  roleCard: {
    backgroundColor: colors.primary100,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary500,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeRight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 4,
  },
  roleSub: {
    fontSize: 14,
    color: colors.gray500,
  },
  logoutButton: {
    width: '100%',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
  },
  profileSwitch: {
    width: '100%',
    marginBottom: 16,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
