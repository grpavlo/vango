import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';
import AppText from './AppText';

export default function CheckBox({ value, onChange, label, style }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      style={[styles.container, style]}
    >
      <View style={[styles.box, value && styles.boxChecked]}>
        {value && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      {label && <AppText style={styles.label}>{label}</AppText>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxChecked: {
    backgroundColor: colors.green,
  },
  label: { marginLeft: 8, color: colors.text },
});
