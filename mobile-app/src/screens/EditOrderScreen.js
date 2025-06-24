import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import DateTimeInput from '../components/DateTimeInput';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import { colors } from '../components/Colors';
import Slider from '@react-native-community/slider';
import PhotoPicker from '../components/PhotoPicker';
import OptionSwitch from '../components/OptionSwitch';
import CheckBox from '../components/CheckBox';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, API_URL } from '../api';
import { useAuth } from '../AuthContext';

export default function EditOrderScreen({ route, navigation }) {
  const { token } = useAuth();
  const { order } = route.params;

  const [pickupQuery, setPickupQuery] = useState(order.pickupLocation || '');
  const [pickup, setPickup] = useState(
    order.pickupLat
      ? {
          text: order.pickupLocation,
          lat: order.pickupLat,
          lon: order.pickupLon,
          city: order.pickupCity,
          address: order.pickupAddress,
          country: order.pickupCountry,
          postcode: order.pickupPostcode,
        }
      : null
  );
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffQuery, setDropoffQuery] = useState(order.dropoffLocation || '');
  const [dropoff, setDropoff] = useState(
    order.dropoffLat
      ? {
          text: order.dropoffLocation,
          lat: order.dropoffLat,
          lon: order.dropoffLon,
          city: order.dropoffCity,
          address: order.dropoffAddress,
          country: order.dropoffCountry,
          postcode: order.dropoffPostcode,
        }
      : null
  );
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [length, setLength] = useState(order.dimensions.split('x')[0] || '');
  const [width, setWidth] = useState(order.dimensions.split('x')[1] || '');
  const [height, setHeight] = useState(order.dimensions.split('x')[2] || '');
  const [weight, setWeight] = useState(String(order.weight || ''));
  const [volWeight, setVolWeight] = useState(String(order.volWeight || '0'));
  const [loadHelp, setLoadHelp] = useState(order.loadHelp);
  const [unloadHelp, setUnloadHelp] = useState(order.unloadHelp);
  const [payment, setPayment] = useState(order.payment || 'cash');

  const pickupTimer = useRef(null);
  const dropoffTimer = useRef(null);
  const now = new Date();
  const startDay = new Date(order.loadFrom);
  const endDay = new Date(order.loadTo);
  const [loadFrom, setLoadFrom] = useState(new Date(order.loadFrom));
  const [loadTo, setLoadTo] = useState(new Date(order.loadTo));
  const [unloadFrom, setUnloadFrom] = useState(new Date(order.unloadFrom));
  const [unloadTo, setUnloadTo] = useState(new Date(order.unloadTo));
  const [photos, setPhotos] = useState(
    order.photos ? order.photos.map((p) => `${API_URL}${p}`) : []
  );
  const [description, setDescription] = useState(order.cargoType || '');
  const [systemPrice, setSystemPrice] = useState(order.systemPrice || null);
  const [adjust, setAdjust] = useState(0);

  useEffect(() => {
    async function calcPrice() {
      if (pickup && dropoff) {
        try {
          const res = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${pickup.lon},${pickup.lat};${dropoff.lon},${dropoff.lat}?overview=false`
          );
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const km = data.routes[0].distance / 1000;
            const base = km * 50;
            setSystemPrice(base);
          }
        } catch (err) {
          console.log(err);
        }
      }
    }
    calcPrice();
  }, [pickup, dropoff]);

  useEffect(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    const v = l * w * h * 250;
    setVolWeight(v.toFixed(2));
  }, [length, width, height]);

  async function save() {
    try {
      const fd = new FormData();
      if (pickup) {
        fd.append('pickupLocation', pickup.text);
        fd.append('pickupLat', pickup.lat);
        fd.append('pickupLon', pickup.lon);
        if (pickup.city) fd.append('pickupCity', pickup.city);
        if (pickup.address) fd.append('pickupAddress', pickup.address);
        if (pickup.country) fd.append('pickupCountry', pickup.country);
        if (pickup.postcode) fd.append('pickupPostcode', pickup.postcode);
      }
      if (dropoff) {
        fd.append('dropoffLocation', dropoff.text);
        fd.append('dropoffLat', dropoff.lat);
        fd.append('dropoffLon', dropoff.lon);
        if (dropoff.city) fd.append('dropoffCity', dropoff.city);
        if (dropoff.address) fd.append('dropoffAddress', dropoff.address);
        if (dropoff.country) fd.append('dropoffCountry', dropoff.country);
        if (dropoff.postcode) fd.append('dropoffPostcode', dropoff.postcode);
      }
      if (pickup?.city) {
        fd.append('city', pickup.city);
      }
      fd.append('cargoType', description);
      fd.append('dimensions', `${length}x${width}x${height}`);
      fd.append('weight', weight || '0');
      fd.append('loadFrom', loadFrom.toISOString());
      fd.append('loadTo', loadTo.toISOString());
      fd.append('unloadFrom', unloadFrom.toISOString());
      fd.append('unloadTo', unloadTo.toISOString());
      fd.append('insurance', 'false');
      fd.append('volWeight', volWeight);
      fd.append('loadHelp', loadHelp ? 'true' : 'false');
      fd.append('unloadHelp', unloadHelp ? 'true' : 'false');
      fd.append('payment', payment);
      const finalPrice = Math.round((systemPrice || 0) * (1 + adjust / 100));
      fd.append('price', finalPrice.toString());
      if (photos && photos.length > 0) {
        photos.forEach((p) => {
          const filename = p.split('/').pop();
          const match = /\.([a-zA-Z0-9]+)$/.exec(filename || '');
          const type = match ? `image/${match[1]}` : 'image';
          fd.append('photos', { uri: p, name: filename, type });
        });
      }
      const updated = await apiFetch(`/orders/${order.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      navigation.replace('OrderDetail', { order: updated });
    } catch (err) {
      console.log(err);
    }
  }

  async function confirmSave() {
    if (!pickup || !dropoff) {
      Alert.alert('Помилка', 'Вкажіть адреси завантаження та розвантаження');
      return;
    }
    if (systemPrice === null) {
      Alert.alert('Помилка', 'Не вдалося розрахувати ціну');
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
    Alert.alert('Підтвердження', 'Зберегти зміни?', [
      { text: 'Скасувати' },
      { text: 'OK', onPress: save },
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
        )}&format=json&limit=5&countrycodes=ua&addressdetails=1`,
        { headers: { 'User-Agent': 'vango-app' } }
      );
      const data = await res.json();
      setter(data);
    } catch {}
  }




  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={32} color="#333" />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <AppText style={styles.label}>Звідки</AppText>
      <View style={{ position: 'relative', zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppInput
            style={{ flex: 1 }}
            value={pickupQuery}
            onChangeText={(t) => {
              setPickupQuery(t);
              setPickup(null);
              if (pickupTimer.current) clearTimeout(pickupTimer.current);
              pickupTimer.current = setTimeout(
                () => loadSuggestions(t, setPickupSuggestions),
                1000
              );
            }}
          />
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() =>
              navigation.navigate('MapSelect', {
                address: pickupQuery,
                lat: pickup?.lat,
                lon: pickup?.lon,
                onSelect: (p) => {
                  setPickup(p);
                  setPickupQuery(p.text || pickupQuery);
                },
              })
            }
          >
            <Ionicons name="map" size={24} color={colors.green} />
          </TouchableOpacity>
        </View>
        {pickupSuggestions.length > 0 && (
          <View style={[styles.suggestionsDropdown, styles.suggestionsBox]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {pickupSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.suggestionItem}
                  onPress={() => {
                    const addr = item.address || {};
                    setPickup({
                      text: item.display_name,
                      lat: item.lat,
                      lon: item.lon,
                      city: addr.city || addr.town || addr.village || addr.state || '',
                      address: [addr.road, addr.house_number].filter(Boolean).join(' '),
                      country: addr.country || '',
                      postcode: addr.postcode || '',
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
        )}
      </View>


      <AppText style={styles.label}>Куди</AppText>
      <View style={{ position: 'relative', zIndex: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppInput
            style={{ flex: 1 }}
            value={dropoffQuery}
            onChangeText={(t) => {
              setDropoffQuery(t);
              setDropoff(null);
              if (dropoffTimer.current) clearTimeout(dropoffTimer.current);
              dropoffTimer.current = setTimeout(
                () => loadSuggestions(t, setDropoffSuggestions),
                1000
              );
            }}
          />
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() =>
              navigation.navigate('MapSelect', {
                address: dropoffQuery,
                lat: dropoff?.lat,
                lon: dropoff?.lon,
                onSelect: (p) => {
                  setDropoff(p);
                  setDropoffQuery(p.text || dropoffQuery);
                },
              })
            }
          >
            <Ionicons name="map" size={24} color={colors.green} />
          </TouchableOpacity>
        </View>
        {dropoffSuggestions.length > 0 && (
          <View style={[styles.suggestionsDropdown, styles.suggestionsBox]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {dropoffSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.suggestionItem}
                  onPress={() => {
                    const addr = item.address || {};
                    setDropoff({
                      text: item.display_name,
                      lat: item.lat,
                      lon: item.lon,
                      city: addr.city || addr.town || addr.village || addr.state || '',
                      address: [addr.road, addr.house_number].filter(Boolean).join(' '),
                      country: addr.country || '',
                      postcode: addr.postcode || '',
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
        )}
      </View>

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

      <AppText style={styles.label}>Вага, кг</AppText>
      <AppInput value={weight} onChangeText={setWeight} keyboardType="numeric" />

      <AppText style={styles.label}>Об'ємна вага, кг</AppText>
      <AppInput value={volWeight} editable={false} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <CheckBox value={loadHelp} onChange={setLoadHelp} label="Завантаження" />
        <CheckBox value={unloadHelp} onChange={setUnloadHelp} label="Розвантаження" />
      </View>

      <AppText style={styles.label}>Оплата</AppText>
      <OptionSwitch
        options={[{ label: 'Готівка', value: 'cash' }, { label: 'Карта', value: 'card' }]}
        value={payment}
        onChange={setPayment}
      />

      <AppText style={styles.label}>Опис вантажу</AppText>
      <AppInput
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ height: 100, textAlignVertical: 'top' }}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} />

      {systemPrice !== null && (
        <View style={{ marginTop: 16 }}>
          <AppText style={styles.label}>
            Ціна: {Math.round(systemPrice * (1 + adjust / 100))} грн
          </AppText>
          <Slider
            minimumValue={-5}
            maximumValue={15}
            step={1}
            value={adjust}
            onValueChange={setAdjust}
            thumbTintColor={colors.green}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText>-5%</AppText>
            <AppText>+15%</AppText>
          </View>
        </View>
      )}

      <AppButton title="Зберегти" onPress={confirmSave} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  dim: { flex: 1 },
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
  suggestionsDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
  },
  back: { position: 'absolute', top: 40, left: 20, backgroundColor: '#fff', borderRadius: 20, padding: 6, zIndex: 100 },
  mapBtn: { marginLeft: 8 },
});
