import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';
import { navigationRef } from '../navigationRef';
import {
  getUnreadNotificationCount,
  subscribeNotifications,
} from '../notificationCenter';

export default function NotificationBell({ style, iconColor = colors.gray900 }) {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeNotifications(setItems), []);

  const unreadCount = useMemo(() => getUnreadNotificationCount(items), [items]);

  function openCenter() {
    navigationRef.navigate('Notifications');
  }

  return (
    <Pressable
      onPress={openCenter}
      style={({ pressed }) => [styles.bellButton, pressed && styles.pressed, style]}
      hitSlop={10}
    >
      <Ionicons name="notifications-outline" size={24} color={iconColor} />
      {unreadCount > 0 && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  unreadDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
