import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../AuthContext';
import { apiFetch, HOST_URL } from '../api';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import DateInput from '../components/DateInput';
import OrderCard from '../components/OrderCard';

export default function AllOrdersScreen({ navigation }) {
  const { token } = useAuth();

  const [date, setDate] = useState(new Date());
  const [pickupCity, setPickupCity] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [volume, setVolume] = useState('');
  const [weight, setWeight] = useState('');
  const [orders, setOrders] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState('30');
  const [location, setLocation] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    async function detectCity() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'vango-app' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.state || '';
          setPickupCity(city);
        }
      } catch {}
    }
    detectCity();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [date, pickupCity, dropoffCity, volume, weight]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, date, pickupCity, dropoffCity, volume, weight, radius, location]);

  async function fetchOrders() {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', formatDate(date));
      if (pickupCity) params.append('pickupCity', pickupCity);
      if (dropoffCity) params.append('dropoffCity', dropoffCity);
      if (volume) params.append('minVolume', volume);
      if (weight) params.append('minWeight', weight);
      const query = params.toString();
      const data = await apiFetch(`/orders${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let list = data.available;
      if (radius && location) {
        const r = parseFloat(radius);
        if (!isNaN(r) && r > 0) {
          list = list.filter((o) => {
            if (!o.pickupLat || !o.pickupLon) return false;
            const dist = haversine(location.latitude, location.longitude, o.pickupLat, o.pickupLon);
            return dist <= r;
          });
        }
      }
      setOrders(list);
    } catch (err) {
      console.log(err);
    }
  }

  function passesFilters(o) {
    if (date && formatDate(new Date(o.loadFrom)) !== formatDate(date)) return false;
    if (pickupCity && !(o.pickupCity || '').toLowerCase().includes(pickupCity.toLowerCase())) return false;
    if (dropoffCity && !(o.dropoffCity || '').toLowerCase().includes(dropoffCity.toLowerCase())) return false;
    if (volume && parseFloat(o.volume || 0) < parseFloat(volume)) return false;
    if (weight && parseFloat(o.weight || 0) < parseFloat(weight)) return false;
    if (radius && location) {
      const r = parseFloat(radius);
      if (!isNaN(r) && r > 0) {
        if (!o.pickupLat || !o.pickupLon) return false;
        const dist = haversine(location.latitude, location.longitude, o.pickupLat, o.pickupLon);
        if (dist > r) return false;
      }
    }
    return true;
  }

  function connectWs() {
    if (!token) return;
    if (wsRef.current) wsRef.current.close();
    const params = new URLSearchParams();
    if (date) params.append('date', formatDate(date));
    if (pickupCity) params.append('pickupCity', pickupCity);
    if (dropoffCity) params.append('dropoffCity', dropoffCity);
    if (volume) params.append('minVolume', volume);
    if (weight) params.append('minWeight', weight);
    const url = `${HOST_URL.replace(/^http/, 'ws')}/api/orders/stream?${params}`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const order = JSON.parse(ev.data);
        if (!passesFilters(order)) return;
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === order.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = order;
            return copy;
          }
          return [order, ...prev];
        });
      } catch (e) {
        console.log('ws message error', e);
      }
    };
    ws.onerror = (e) => console.log('ws error', e.message);
  }

  function clearFilters() {
    setDate(new Date());
    setPickupCity('');
    setDropoffCity('');
    setVolume('');
    setWeight('');
    setRadius('30');
  }

  async function refresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { order: item, token })}>
        <OrderCard order={item} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <AppButton
        title={showFilters ? 'Сховати фільтр' : 'Фільтр'}
        onPress={() => setShowFilters((v) => !v)}
        style={styles.toggle}
      />
      {showFilters && (
        <View style={styles.filters}>
          <DateInput value={date} onChange={setDate} style={styles.input} />
          <AppInput
            placeholder="Місто завантаження"
            value={pickupCity}
            onChangeText={setPickupCity}
            style={styles.input}
          />
          <AppInput
            placeholder="Місто розвантаження"
            value={dropoffCity}
            onChangeText={setDropoffCity}
            style={styles.input}
          />
          <AppInput
            placeholder="Обʼєм м³"
            value={volume}
            onChangeText={setVolume}
            keyboardType="numeric"
            style={styles.input}
          />
          <AppInput
            placeholder="Вага кг"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.radiusRow}>
            <AppButton
              title="-"
              onPress={() => setRadius((r) => Math.max(0, (parseFloat(r) || 0) - 10).toString())}
              style={styles.radiusButton}
            />
            <AppInput
              placeholder="Радіус км"
              value={radius.toString()}
              onChangeText={setRadius}
              keyboardType="numeric"
              style={[styles.input, styles.radiusInput]}
            />
            <AppButton
              title="+"
              onPress={() => setRadius((r) => ((parseFloat(r) || 0) + 10).toString())}
              style={styles.radiusButton}
            />
          </View>
          <AppButton title="Пошук" onPress={fetchOrders} style={styles.input} />
          <AppButton title="Очистити" color="#777" onPress={clearFilters} style={styles.input} />
        </View>
      )}
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(o) => o.id.toString()}
        onRefresh={refresh}
        refreshing={refreshing}
      />
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: {
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  input: { margin: 4, flexBasis: '48%' },
  toggle: { marginHorizontal: 12 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexBasis: '100%' },
  radiusButton: { flex: 1, marginHorizontal: 4 },
  radiusInput: { flex: 2, textAlign: 'center' },
});

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
