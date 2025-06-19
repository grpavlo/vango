import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';

export default function DateTimeInput({ value, onChange }) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  function onChangeDate(_e, selected) {
    setShowDate(false);
    if (!selected) return;
    const newDate = new Date(value);
    newDate.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(newDate);
  }

  function onChangeTime(_e, selected) {
    setShowTime(false);
    if (!selected) return;
    const newDate = new Date(value);
    newDate.setHours(selected.getHours());
    newDate.setMinutes(selected.getMinutes());
    onChange(newDate);
  }

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => setShowDate(true)}>
          <AppInput value={formatDate(value)} editable={false} pointerEvents="none" />
        </TouchableOpacity>
        {showDate && (
          <DateTimePicker value={value} mode="date" is24Hour onChange={onChangeDate} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => setShowTime(true)}>
          <AppInput value={formatTime(value)} editable={false} pointerEvents="none" />
        </TouchableOpacity>
        {showTime && (
          <DateTimePicker value={value} mode="time" is24Hour onChange={onChangeTime} />
        )}
      </View>
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});
