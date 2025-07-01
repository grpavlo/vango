import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function AppButton({
  title,
  variant = 'success',
  color,
  style,
  textStyle,
  disabled,
  ...props
}) {
  const bgColor =
    color ||
    (variant === 'warning'
      ? colors.orange
      : variant === 'danger'
      ? colors.red
      : colors.green);

  const getStyle = ({ pressed }) => [
    styles.button,
    {
      backgroundColor: bgColor,
      opacity: disabled ? 0.4 : 1,
    },
    pressed && { transform: [{ scale: 0.92 }] },
    style,
  ];

  return (
    <Pressable style={getStyle} disabled={disabled} {...props}>
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
