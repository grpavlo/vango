import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

export default function CheckBox({ value, onChange, size = 24 }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={size}
        color={colors.green}
      />
    </TouchableOpacity>
  );
}
