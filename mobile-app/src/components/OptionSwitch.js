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
            value === opt.value && (idx === 0 ? styles.activeLeft : styles.activeRight),
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
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
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
  text: { color: colors.text },
  activeText: { color: '#fff' },
});
