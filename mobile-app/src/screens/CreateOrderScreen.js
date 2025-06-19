import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import DateTimeInput from '../components/DateTimeInput';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import { colors } from '../components/Colors';
import PhotoPicker from '../components/PhotoPicker';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function CreateOrderScreen({ navigation }) {
  const { token } = useAuth();

  const [pickupQuery, setPickupQuery] = useState('');
  const [pickup, setPickup] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [dropoff, setDropoff] = useState(null);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const now = new Date();
  const [loadFrom, setLoadFrom] = useState(now);
  const [loadTo, setLoadTo] = useState(new Date(now.getTime() + 60 * 60 * 1000));
  const [unloadFrom, setUnloadFrom] = useState(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const [unloadTo, setUnloadTo] = useState(new Date(now.getTime() + 25 * 60 * 60 * 1000));
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');

  async function create() {
    try {
      const fd = new FormData();
      if (pickup) {
        fd.append('pickupLocation', pickup.text);
        fd.append('pickupLat', pickup.lat);
        fd.append('pickupLon', pickup.lon);
      }
      if (dropoff) {
        fd.append('dropoffLocation', dropoff.text);
        fd.append('dropoffLat', dropoff.lat);
        fd.append('dropoffLon', dropoff.lon);
      }
      fd.append('cargoType', description);
      fd.append('dimensions', `${length}x${width}x${height}`);
      fd.append('weight', '0');
      fd.append('loadFrom', loadFrom.toISOString());
      fd.append('loadTo', loadTo.toISOString());
      fd.append('unloadFrom', unloadFrom.toISOString());
      fd.append('unloadTo', unloadTo.toISOString());
      fd.append('insurance', 'false');
      if (photo) {
        const filename = photo.split('/').pop();
        const match = /\.([a-zA-Z0-9]+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        fd.append('photo', { uri: photo, name: filename, type });
      }
      await apiFetch('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      navigation.goBack();
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmCreate() {
    if (!pickup || !dropoff) {
      Alert.alert('Помилка', 'Вкажіть адреси завантаження та розвантаження');
      return;
    }
    if (loadFrom < new Date()) {
      Alert.alert('Помилка', 'Дата завантаження не може бути в минулому');
      return;
    }
    if (loadTo <= loadFrom) {
      Alert.alert('Помилка', 'Кінцева дата завантаження повинна бути пізніше початкової');
      return;
    }
    if (unloadFrom <= loadTo) {
      Alert.alert('Помилка', 'Дата початку розвантаження повинна бути після закінчення завантаження');
      return;
    }
    if (unloadTo <= unloadFrom) {
      Alert.alert('Помилка', 'Кінцева дата розвантаження повинна бути пізніше початкової');
      return;
    }
    Alert.alert('Підтвердження', 'Ви впевнені що хочете розмістити вантаж?', [
      { text: 'Скасувати' },
      { text: 'OK', onPress: create },
    ]);
  }

  async function loadSuggestions(text, setter) {
    if (text.length < 3) {
      setter([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          text
        )}&format=json&limit=5`,
        { headers: { 'User-Agent': 'vango-app' } }
      );
      const data = await res.json();
      setter(data);
    } catch {}
  }




  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <AppText style={styles.label}>Звідки</AppText>
      <AppInput
        value={pickupQuery}
        onChangeText={(t) => {
          setPickupQuery(t);
          setPickup(null);
          loadSuggestions(t, setPickupSuggestions);
        }}
      />
      {pickupSuggestions.length > 0 && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setPickupSuggestions([])}
          >
            <View style={styles.suggestionsBox}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {pickupSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setPickup({
                        text: item.display_name,
                        lat: item.lat,
                        lon: item.lon,
                      });
                      setPickupQuery(item.display_name);
                      setPickupSuggestions([]);
                      setDropoffSuggestions([]);
                    }}
                  >
                    <AppText style={styles.suggestionMain}>{item.display_name}</AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <AppText style={styles.label}>Куди</AppText>
      <AppInput
        value={dropoffQuery}
        onChangeText={(t) => {
          setDropoffQuery(t);
          setDropoff(null);
          loadSuggestions(t, setDropoffSuggestions);
        }}
      />
      {dropoffSuggestions.length > 0 && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setDropoffSuggestions([])}
          >
            <View style={styles.suggestionsBox}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {dropoffSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setDropoff({
                        text: item.display_name,
                        lat: item.lat,
                        lon: item.lon,
                      });
                      setDropoffQuery(item.display_name);
                      setPickupSuggestions([]);
                      setDropoffSuggestions([]);
                    }}
                  >
                    <AppText style={styles.suggestionMain}>{item.display_name}</AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <AppText style={styles.label}>Завантаження</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <DateInput
          value={loadFrom}
          onChange={(d) => {
            const from = new Date(loadFrom);
            from.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            const to = new Date(loadTo);
            to.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setLoadFrom(from);
            setLoadTo(to);
          }}
          style={{ marginVertical: 0 }}
        />
        <View style={{ flexDirection: 'column' }}>
          <TimeInput value={loadFrom} onChange={setLoadFrom} style={{ marginVertical: 0 }} />
          <TimeInput value={loadTo} onChange={setLoadTo} style={{ marginVertical: 0 }} />
        </View>
      </View>

      <AppText style={styles.label}>Вивантаження</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <DateInput
          value={unloadFrom}
          onChange={(d) => {
            const from = new Date(unloadFrom);
            from.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            const to = new Date(unloadTo);
            to.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setUnloadFrom(from);
            setUnloadTo(to);
          }}
          style={{ marginVertical: 0 }}
        />
        <View style={{ flexDirection: 'column' }}>
          <TimeInput value={unloadFrom} onChange={setUnloadFrom} style={{ marginVertical: 0 }} />
          <TimeInput value={unloadTo} onChange={setUnloadTo} style={{ marginVertical: 0 }} />
        </View>
      </View>

      <AppText style={styles.label}>Габарити (Д x Ш x В, м)</AppText>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <AppInput style={styles.dim} value={length} onChangeText={setLength} keyboardType="numeric" placeholder="Д" />
        <AppInput style={styles.dim} value={width} onChangeText={setWidth} keyboardType="numeric" placeholder="Ш" />
        <AppInput style={styles.dim} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="В" />
      </View>

      <AppText style={styles.label}>Опис вантажу</AppText>
      <AppInput
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ height: 100, textAlignVertical: 'top' }}
      />

      <PhotoPicker photo={photo} onChange={setPhoto} />

      <AppButton title="Створити" onPress={confirmCreate} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  dim: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 16,
  },
  suggestionsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  suggestionMain: { fontSize: 16 },
  label: { marginTop: 8, color: colors.text },
});
