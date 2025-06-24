import React, { useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';

export default function DateInput({ value, onChange, style }) {

  const [showDate, setShowDate] = useState(false);

  function onChangeDate(_e, selected) {
    setShowDate(false);
    if (!selected) return;
    const newDate = new Date(value);
    newDate.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(newDate);
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setShowDate(true)}>
        <AppInput
          value={formatDate(value)}
          editable={false}
          pointerEvents="none"
          style={style}
        />
      </TouchableOpacity>
      {showDate && (
        <DateTimePicker
          value={value}
          mode="date"
          is24Hour
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onChangeDate}
        />
      )}
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
