import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

export default function PasswordInput({ style, ...props }) {
  const [secure, setSecure] = useState(true);
  return (
    <View style={{ position: 'relative' }}>
      <TextInput
        {...props}
        secureTextEntry={secure}
        style={[{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, marginVertical: 8 }, style]}
        placeholderTextColor={colors.border}
      />
      <TouchableOpacity
        style={{ position: 'absolute', right: 12, top: 20 }}
        onPress={() => setSecure(!secure)}
      >
        <Ionicons name={secure ? 'eye' : 'eye-off'} size={20} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}
