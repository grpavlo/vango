import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';

export default function DateInput({ value, onChange }) {
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
        <AppInput value={formatDate(value)} editable={false} pointerEvents="none" />
      </TouchableOpacity>
      {showDate && (
        <DateTimePicker value={value} mode="date" is24Hour onChange={onChangeDate} />
      )}
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
