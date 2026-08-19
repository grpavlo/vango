import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';
import { navigationRef } from '../navigationRef';

export default function SupportButton({ style, iconColor = colors.gray900 }) {
  function openSupport() {
    navigationRef.navigate('SupportHelp');
  }

  return (
    <Pressable
      onPress={openSupport}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Підтримка"
    >
      <Ionicons name="headset-outline" size={24} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});
