import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

export default function PasswordInput({ style, ...props }) {
  const [secure, setSecure] = useState(true);
  return (
    <View style={styles.container}>
      <TextInput
        {...props}
        secureTextEntry={secure}
        style={[styles.input, style]}
        placeholderTextColor={colors.gray600}
      />
      <TouchableOpacity
        style={styles.eyeBtn}
        onPress={() => setSecure(!secure)}
      >
        <Ionicons name={secure ? 'eye' : 'eye-off'} size={20} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
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
  eyeBtn: { position: 'absolute', right: 16, top: 18 },
});
