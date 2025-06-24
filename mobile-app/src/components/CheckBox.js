import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';
import AppText from './AppText';

export default function CheckBox({ value, onChange, size = 24, label, style }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      style={[styles.container, style]}
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={size}
        color={colors.green}
      />
      {label && <AppText style={styles.label}>{label}</AppText>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  label: { marginLeft: 4 },
});
