import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function AppInput({ style, ...props }) {
  return <TextInput style={[styles.input, style]} placeholderTextColor={colors.border} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
});
