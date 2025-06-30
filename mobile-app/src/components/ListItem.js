import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

export default function ListItem({
  title,
  onPress,
  children,
  icon,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={24} color={colors.text} style={styles.icon} />
      )}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
      <View style={styles.divider} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    position: 'relative',
  },
  pressed: {
    backgroundColor: colors.press,
  },
  title: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  icon: {
    marginRight: 16,
  },
  content: {
    marginRight: 8,
  },
  divider: {
    position: 'absolute',
    left: 64,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
