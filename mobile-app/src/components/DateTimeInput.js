import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';

export default function DateTimeInput({ value, onChange }) {
  const [show, setShow] = useState(false);
  function onChangeInner(_e, selected) {
    setShow(false);
    if (selected) onChange(selected);
  }
  return (
    <View>
      <TouchableOpacity onPress={() => setShow(true)}>
        <AppInput
          value={formatDate(value)}
          editable={false}
          pointerEvents="none"
        />
      </TouchableOpacity>
      {show && (
        <DateTimePicker value={value} mode="datetime" is24Hour onChange={onChangeInner} />
      )}
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({});
