import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../api';
import AppInput from '../components/AppInput';
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

  useEffect(() => {
    async function detectCity() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
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
    const i = setInterval(fetchOrders, 10000);
    return () => clearInterval(i);
  }, [date, pickupCity, dropoffCity, volume, weight]);

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
      setOrders(data.available);
    } catch (err) {
      console.log(err);
    }
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
      </View>
      <FlatList data={orders} renderItem={renderItem} keyExtractor={(o) => o.id.toString()} />
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
  filters: { padding: 8 },
  input: { marginVertical: 4 },
});
