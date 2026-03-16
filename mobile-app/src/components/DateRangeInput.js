import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppInput from './AppInput';
import AppText from './AppText';
import AppButton from './AppButton';

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export default function DateRangeInput({ valueFrom, valueTo, onChange, placeholder, style }) {
  const [visible, setVisible] = useState(false);
  const [activePicker, setActivePicker] = useState(null); // 'from' | 'to' | null

  const from = valueFrom || new Date();
  const to = valueTo || new Date();

  const displayText =
    valueFrom && valueTo
      ? `${formatDate(valueFrom)} – ${formatDate(valueTo)}`
      : placeholder || 'Обрати дати';

  function handleFromChange(_e, selected) {
    setActivePicker(null);
    if (!selected) return;
    const d = new Date(selected);
    onChange(d, to > d ? to : d);
  }

  function handleToChange(_e, selected) {
    setActivePicker(null);
    if (!selected) return;
    const d = new Date(selected);
    onChange(d >= from ? from : d, d);
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)}>
        <View>
          <AppInput
            value={displayText}
            editable={false}
            pointerEvents="none"
            style={[{ paddingRight: 36, marginVertical: 0 }, style]}
          />
          <Ionicons
            name="calendar-outline"
            size={16}
            color="#000"
            style={styles.icon}
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <SafeAreaView style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <AppText style={styles.modalTitle}>Діапазон дат</AppText>

              <View style={styles.row}>
                <View style={styles.pickerBlock}>
                  <AppText style={styles.label}>З</AppText>
                  <TouchableOpacity
                    style={styles.pickerTouch}
                    onPress={() => setActivePicker('from')}
                  >
                    <AppText>{formatDate(from)}</AppText>
                  </TouchableOpacity>
                </View>
                <View style={styles.pickerBlock}>
                  <AppText style={styles.label}>По</AppText>
                  <TouchableOpacity
                    style={styles.pickerTouch}
                    onPress={() => setActivePicker('to')}
                  >
                    <AppText>{formatDate(to)}</AppText>
                  </TouchableOpacity>
                </View>
              </View>

              {activePicker === 'from' && (
                <DateTimePicker
                  value={from}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleFromChange}
                />
              )}
              {activePicker === 'to' && (
                <DateTimePicker
                  value={to}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleToChange}
                />
              )}

              <AppButton
                title="Готово"
                onPress={() => setVisible(false)}
                style={styles.doneBtn}
              />
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', right: 12, top: 20 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    minHeight: 200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pickerBlock: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pickerTouch: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
  },
  doneBtn: {
    marginTop: 8,
  },
});
