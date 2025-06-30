import React, { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function AppInput({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[styles.input, focused && styles.focused, style]}
      placeholderTextColor={colors.gray600}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 12,
    backgroundColor: colors.background,
  },
  focused: {
    borderColor: colors.green,
    borderWidth: 2,
  },
});
