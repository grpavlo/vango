import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';

export default function UniversalDateTimeInput({
  value,
  onChange,
  mode = 'date',
  placeholder,
  style,
}) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          if (mode === 'time') setShowTime(true);
          else setShowDate(true);
        }}
      >
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
      {showDate && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          is24Hour
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_e, selected) => {
            setShowDate(false);
            if (!selected) return;
            const newDate = new Date(selected);
            if (mode === 'datetime') {
              setTempDate(newDate);
              setShowTime(true);
            } else {
              onChange(newDate);
            }
          }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={mode === 'datetime' ? tempDate : value || new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, selected) => {
            setShowTime(false);
            if (!selected) return;
            const base = mode === 'datetime' ? tempDate : value || new Date();
            const newDate = new Date(base);
            newDate.setHours(selected.getHours());
            newDate.setMinutes(selected.getMinutes());
            onChange(newDate);
          }}
        />
      )}

    </View>
  );
}

function format(d, mode) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  const utc2 = toUtcPlus2(d);
  const dateStr = `${pad(utc2.getUTCDate())}.${pad(
    utc2.getUTCMonth() + 1
  )}.${utc2.getUTCFullYear()}`;
  const timeStr = `${pad(utc2.getUTCHours())}:${pad(utc2.getUTCMinutes())}`;
  if (mode === 'date') return dateStr;
  if (mode === 'time') return timeStr;
  return `${dateStr} ${timeStr}`;
}

function toUtcPlus2(date) {
  if (!date) return new Date(NaN);
  const d = date instanceof Date ? date : new Date(date);
  const utcTime = d.getTime();
  // Працюємо в фіксованому поясі UTC+2, незалежно від поясу пристрою
  return new Date(utcTime + 2 * 60 * 60 * 1000);
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 12, top: 20 },
});
