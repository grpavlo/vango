import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import DatePicker from 'react-native-date-picker';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';

export default function UniversalDateTimeInput({
  value,
  onChange,
  mode = 'date',
  placeholder,
  style,
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(true)}>
        <View>
          <AppInput
            value={format(value, mode)}
            placeholder={placeholder}
            editable={false}
            pointerEvents="none"
            style={[{ paddingRight: 36, marginVertical: 0 }, style]}
          />
          <Ionicons
            name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
            size={16}
            color="#000"
            style={styles.icon}
          />
        </View>
      </TouchableOpacity>
      <DatePicker
        modal
        open={open}
        date={value || new Date()}
        mode={mode}
        onConfirm={(date) => {
          setOpen(false);
          onChange(date);
        }}
        onCancel={() => setOpen(false)}
      />
    </View>
  );
}

function format(d, mode) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  const dateStr = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (mode === 'date') return dateStr;
  if (mode === 'time') return timeStr;
  return `${dateStr} ${timeStr}`;
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 12, top: 20 },
});
