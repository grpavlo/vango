import React, { useState } from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';
import { Ionicons } from '@expo/vector-icons';

export default function DateInput({ value, onChange, style, placeholder }) {

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
        <View>
          <AppInput
            value={formatDate(value)}
            placeholder={placeholder}
            editable={false}
            pointerEvents="none"
            style={[{ paddingRight: 36, marginVertical: 0 }, style]}
          />
          <Ionicons name="calendar-outline" size={16} color="#000" style={styles.icon} />
        </View>
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
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 12, top: 20 },
});
