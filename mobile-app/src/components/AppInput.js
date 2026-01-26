import React, { useState, forwardRef, useCallback } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors } from './Colors';


function AppInput({ style, onFocus, onBlur,keyboardType, ...props }, ref) {
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback((event) => {
    setFocused(true);
    onFocus?.(event);
  }, [onFocus]);

  const handleBlur = useCallback((event) => {
    setFocused(false);
    onBlur?.(event);
  }, [onBlur]);

  return (
    <TextInput
      ref={ref}
      style={[styles.input, focused && styles.focused, style]}
      placeholderTextColor={colors.gray600}
      onFocus={handleFocus}
      onBlur={handleBlur}
      keyboardType={keyboardType}
      {...props}
    />
  );
}

export default forwardRef(AppInput);

const styles = StyleSheet.create({
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 12,
    backgroundColor: colors.surface,
    color: colors.gray900,
    fontSize: 16,
  },
  focused: {
    borderColor: colors.green,
    borderWidth: 2,
  },
});
