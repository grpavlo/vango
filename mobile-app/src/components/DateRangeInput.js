import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';
import AppText from './AppText';

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function DateRangeInput({ valueFrom, valueTo, onChange, placeholder, style }) {
  const [activePicker, setActivePicker] = useState(null); // 'from' | 'to' | null

  const from = valueFrom || new Date();
  const to = valueTo || new Date();

  function handleFromChange(_event, selected) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (!selected) return;
    const nextFrom = new Date(selected);
    onChange(nextFrom, to > nextFrom ? to : nextFrom);
  }

  function handleToChange(_event, selected) {
    if (Platform.OS === 'android') setActivePicker(null);
    if (!selected) return;
    const nextTo = new Date(selected);
    onChange(nextTo >= from ? from : nextTo, nextTo);
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.field}>
          <AppText style={styles.label}>З</AppText>
          <TouchableOpacity
            onPress={() => setActivePicker((prev) => (prev === 'from' ? null : 'from'))}
          >
            <View>
              <AppInput
                value={valueFrom ? formatDate(valueFrom) : placeholder || 'Оберіть дату'}
                editable={false}
                pointerEvents="none"
                style={[styles.input, style]}
              />
              <Ionicons
                name="calendar-outline"
                size={16}
                color="#000"
                style={styles.icon}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <AppText style={styles.label}>По</AppText>
          <TouchableOpacity
            onPress={() => setActivePicker((prev) => (prev === 'to' ? null : 'to'))}
          >
            <View>
              <AppInput
                value={valueTo ? formatDate(valueTo) : placeholder || 'Оберіть дату'}
                editable={false}
                pointerEvents="none"
                style={[styles.input, style]}
              />
              <Ionicons
                name="calendar-outline"
                size={16}
                color="#000"
                style={styles.icon}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {activePicker === 'from' && (
        <DateTimePicker
          value={from}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={to}
          onChange={handleFromChange}
        />
      )}
      {activePicker === 'to' && (
        <DateTimePicker
          value={to}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={from}
          onChange={handleToChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    paddingRight: 36,
    marginVertical: 0,
  },
  icon: {
    position: 'absolute',
    right: 12,
    top: 20,
  },
});
