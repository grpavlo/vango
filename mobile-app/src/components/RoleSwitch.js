import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

export default function RoleSwitch({ value, onChange, style }) {
  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={[styles.option, value === 'CUSTOMER' && styles.activeLeft]}
        onPress={() => onChange('CUSTOMER')}
      >
        <Ionicons name="person" size={20} color={value === 'CUSTOMER' ? '#fff' : colors.text} />
        <Text style={[styles.text, value === 'CUSTOMER' && styles.activeText]}> Замовник</Text>
      </Pressable>
      <Pressable
        style={[styles.option, value === 'DRIVER' && styles.activeRight]}
        onPress={() => onChange('DRIVER')}
      >
        <Ionicons name="car" size={20} color={value === 'DRIVER' ? '#fff' : colors.text} />
        <Text style={[styles.text, value === 'DRIVER' && styles.activeText]}> Водій</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeLeft: {
    backgroundColor: colors.green,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  activeRight: {
    backgroundColor: colors.green,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  activeText: {
    color: '#fff',
  },
  text: {
    color: colors.text,
  },
});
