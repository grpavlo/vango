import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function AppButton({ title, color = colors.green, style, textStyle, ...props }) {
  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: color }, style]} {...props}>
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});
