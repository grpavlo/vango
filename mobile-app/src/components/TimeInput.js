import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';

export default function TimeInput({ value, onChange }) {
  const [showTime, setShowTime] = useState(false);

  function onChangeTime(_e, selected) {
    setShowTime(false);
    if (!selected) return;
    const newDate = new Date(value);
    newDate.setHours(selected.getHours());
    newDate.setMinutes(selected.getMinutes());
    onChange(newDate);
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setShowTime(true)}>
        <AppInput value={formatTime(value)} editable={false} pointerEvents="none" />
      </TouchableOpacity>
      {showTime && (
        <DateTimePicker value={value} mode="time" is24Hour onChange={onChangeTime} />
      )}
    </View>
  );
}

function formatTime(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
