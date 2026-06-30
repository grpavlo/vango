import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function OptionSwitch({ options, value, onChange, style }) {
  return (
    <View style={[styles.container, style]}>
      {options.map((opt, idx) => (
        <Pressable
          key={opt.value}
          style={[
            styles.option,
            value === opt.value && styles.active,
            value === opt.value && idx === 0 && styles.activeLeft,
            value === opt.value && idx === options.length - 1 && styles.activeRight,
          ]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.text, value === opt.value && styles.activeText]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 24,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  activeLeft: {
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  active: {
    backgroundColor: colors.green,
  },
  activeRight: {
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  text: { color: colors.gray700, fontWeight: '600' },
  activeText: { color: '#fff', fontWeight: '600' },
});
