import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function AppText({ children, style, ...props }) {
  return (
    <Text style={[styles.text, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.text,
    fontSize: 16,
  },
});
