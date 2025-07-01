import React, { useState } from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppInput from './AppInput';
import { Ionicons } from '@expo/vector-icons';

export default function TimeInput({ value, onChange, style, placeholder }) {

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
        <View>
          <AppInput
            value={formatTime(value)}
            placeholder={placeholder}
            editable={false}
            pointerEvents="none"
            style={[{ paddingRight: 36, marginVertical: 0 }, style]}
          />
          <Ionicons name="time-outline" size={16} color="#000" style={styles.icon} />
        </View>
      </TouchableOpacity>
      {showTime && (
        <DateTimePicker
          value={value}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChangeTime}
        />
      )}
    </View>
  );
}

function formatTime(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 12, top: 20 },
});
