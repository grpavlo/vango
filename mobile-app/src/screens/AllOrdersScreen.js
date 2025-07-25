import React, { useEffect, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, Modal, SafeAreaView, ScrollView } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '../AuthContext';
import { apiFetch, HOST_URL } from '../api';
import AppInput from '../components/AppInput';
import AddressSearchInput from '../components/AddressSearchInput';
import AppButton from '../components/AppButton';
import DateInput from '../components/DateInput';
import OrderCard from '../components/OrderCard';
import OrderCardSkeleton from '../components/OrderCardSkeleton';
import BottomSheet from '../components/BottomSheet';
import { colors } from '../components/Colors';

export default function AllOrdersScreen({ navigation }) {
  const { token } = useAuth();

  const [date, setDate] = useState(new Date());
  const [pickupCity, setPickupCity] = useState('');
  const [pickupPoint, setPickupPoint] = useState(null);
  const [volume, setVolume] = useState('');
  const [weight, setWeight] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState('30');
  const [location, setLocation] = useState(null);
  const wsRef = useRef(null);
  const [detected, setDetected] = useState(false);
  const sheetRef = useRef(null);
  const listRef = useRef(null);
  const mapRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightTimer = useRef(null);

  useEffect(() => {
    async function detectCity() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const locObj = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setLocation(locObj);
          await AsyncStorage.setItem('location', JSON.stringify(locObj));
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'vango-app' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.state || '';
          setPickupCity(city);
          setPickupPoint(null);
          if (city) await AsyncStorage.setItem('pickupCity', city);
        }
      } catch {}
      setDetected(true);
    }

    async function init() {
      try {
        const storedCity = await AsyncStorage.getItem('pickupCity');
        const locStr = await AsyncStorage.getItem('location');
        if (storedCity) {
          setPickupCity(storedCity);
          setPickupPoint(null);
        }
        if (locStr) setLocation(JSON.parse(locStr));
        if (storedCity || locStr) {
          setDetected(true);
          return;
        }
      } catch {}
      detectCity();
    }

    init();
  }, []);

  useEffect(() => {
    if (!detected) return;
    fetchOrders();
    const unsubscribe = navigation.addListener('focus', fetchOrders);
    return unsubscribe;
  }, [detected, navigation]);

  useEffect(() => {
    if (!detected) return;
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [detected, token, location, pickupPoint]);

  async function fetchOrders() {
    try {
      setLoading(true);
    const params = new URLSearchParams();
    if (date) params.append('date', formatDate(date));
    const origin = pickupPoint
      ? { latitude: parseFloat(pickupPoint.lat), longitude: parseFloat(pickupPoint.lon) }
      : location;

    const useRadius = radius && origin && !isNaN(parseFloat(radius));
    if (!useRadius && pickupCity)
      params.append('pickupCity', pickupPoint?.city || pickupCity);
    const vol = parseNumber(volume);
    if (!isNaN(vol)) params.append('maxVolume', vol);
    const wt = parseNumber(weight);
    if (!isNaN(wt)) params.append('maxWeight', wt);
    if (useRadius) {
      params.append('lat', origin.latitude);
      params.append('lon', origin.longitude);
      params.append('radius', parseFloat(radius));
    }
    const query = params.toString();
      const data = await apiFetch(`/orders${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let list = data.available;
      if (radius && origin) {
        const r = parseFloat(radius);
        if (!isNaN(r) && r > 0) {
          list = list.filter((o) => {
            if (!o.pickupLat || !o.pickupLon) return false;
            const dist = haversine(origin.latitude, origin.longitude, o.pickupLat, o.pickupLon);
            return dist <= r;
          });
        }
      }
      setOrders(list);
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  }

  function passesFilters(o) {
    if (o.deleted) return false;
    const now = new Date();
    if (o.status !== 'CREATED') return false;
    if (o.reservedBy && o.reservedUntil && new Date(o.reservedUntil) > now) return false;
    if (date && formatDate(new Date(o.loadFrom)) !== formatDate(date)) return false;
    if (pickupCity && !(o.pickupCity || '').toLowerCase().includes(pickupCity.toLowerCase())) return false;
    if (volume && parseFloat(o.volume || 0) > parseNumber(volume)) return false;
    if (weight && parseFloat(o.weight || 0) > parseNumber(weight)) return false;
    const origin = pickupPoint ? { latitude: parseFloat(pickupPoint.lat), longitude: parseFloat(pickupPoint.lon) } : location;
    if (radius && origin) {
      const r = parseFloat(radius);
      if (!isNaN(r) && r > 0) {
        if (!o.pickupLat || !o.pickupLon) return false;
        const dist = haversine(origin.latitude, origin.longitude, o.pickupLat, o.pickupLon);
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
    const origin = pickupPoint
      ? { latitude: parseFloat(pickupPoint.lat), longitude: parseFloat(pickupPoint.lon) }
      : location;
    const useRadius = radius && origin && !isNaN(parseFloat(radius));
    if (!useRadius && pickupCity)
      params.append('pickupCity', pickupPoint?.city || pickupCity);
    const vol = parseNumber(volume);
    if (!isNaN(vol)) params.append('maxVolume', vol);
    const wt = parseNumber(weight);
    if (!isNaN(wt)) params.append('maxWeight', wt);
    if (useRadius) {
      params.append('lat', origin.latitude);
      params.append('lon', origin.longitude);
      params.append('radius', parseFloat(radius));
    }
    const url = `${HOST_URL.replace(/^http/, 'ws')}/api/orders/stream?${params}`;
    const ws = new WebSocket(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const order = JSON.parse(ev.data);
        setOrders((prev) => {
          if (order.deleted) {
            return prev.filter((o) => o.id !== order.id);
          }
          if (!passesFilters(order)) {
            return prev.filter((o) => o.id !== order.id);
          }
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
    setPickupPoint(null);
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
      <OrderCard
        order={item}
        highlighted={item.id === highlightedId}
        onPress={() => navigation.navigate('OrderDetail', { order: item, token })}
      />
    );
  }

  function onMarkerPress(id) {
    const index = orders.findIndex((o) => o.id === id);
    if (index >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index, animated: true });
    }
    setHighlightedId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 3000);
    sheetRef.current?.expand();
  }

  useEffect(() => {
    if (!mapRef.current) return;
    const origin = pickupPoint
      ? { latitude: parseFloat(pickupPoint.lat), longitude: parseFloat(pickupPoint.lon) }
      : location;

    let coords = orders
      .filter((o) => o.pickupLat && o.pickupLon)
      .map((o) => ({ latitude: o.pickupLat, longitude: o.pickupLon }));

    if (origin && radius) {
      const r = parseFloat(radius);
      if (!isNaN(r) && r > 0) {
        const latDelta = r / 111;
        const lonDelta = r / (111 * Math.cos((origin.latitude * Math.PI) / 180));
        coords = coords.concat([
          { latitude: origin.latitude + latDelta, longitude: origin.longitude + lonDelta },
          { latitude: origin.latitude + latDelta, longitude: origin.longitude - lonDelta },
          { latitude: origin.latitude - latDelta, longitude: origin.longitude + lonDelta },
          { latitude: origin.latitude - latDelta, longitude: origin.longitude - lonDelta },
        ]);
      }
    }

    if (coords.length) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  }, [orders, radius, pickupPoint, location]);


  const originPoint = pickupPoint
    ? { latitude: parseFloat(pickupPoint.lat), longitude: parseFloat(pickupPoint.lon) }
    : location;
  const region = originPoint
    ? { latitude: originPoint.latitude, longitude: originPoint.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 }
    : { latitude: 50.45, longitude: 30.523, latitudeDelta: 0.2, longitudeDelta: 0.2 };

  return (
    <View style={{ flex: 1 }}>
      <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={region} showsUserLocation>
        {originPoint && (
          <Circle
            center={originPoint}
            radius={parseFloat(radius || '0') * 1000}
            fillColor="rgba(22,163,74,0.15)"
            strokeColor="rgba(22,163,74,0.4)"
          />
        )}
        {orders.map(
          (o) =>
            o.pickupLat &&
            o.pickupLon && (
              <Marker
                key={o.id}
                coordinate={{ latitude: o.pickupLat, longitude: o.pickupLon }}
                pinColor={colors.orange}
                onPress={() => onMarkerPress(o.id)}
              />
            )
        )}
      </MapView>
      <BottomSheet ref={sheetRef}>
        <View style={{ paddingHorizontal: 12, flex: 1 }}>
          <AppButton title="Фільтр" onPress={() => setFiltersVisible(true)} style={styles.toggle} />
      <Modal visible={filtersVisible} animationType="slide" onRequestClose={() => setFiltersVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.filters}>
          <DateInput value={date} onChange={setDate} style={styles.input} />
          <AddressSearchInput
            placeholder="Місце завантаження"
            value={pickupCity}
            onChangeText={(t) => {
              setPickupCity(t);
              if (!t) setPickupPoint(null);
            }}
            onSelect={setPickupPoint}
            navigation={navigation}
            onOpenMap={() => setFiltersVisible(false)}
            onCloseMap={() => setFiltersVisible(true)}
            lat={pickupPoint?.lat}
            lon={pickupPoint?.lon}
            currentLocation={location}
            style={styles.input}
          />
          <AppInput
            placeholder="Обʼєм до м³"
            value={volume}
            onChangeText={setVolume}
            keyboardType="numeric"
            style={styles.input}
          />
          <AppInput
            placeholder="Вага до кг"
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
          <View style={styles.actionsRow}>
            <AppButton title="Очистити" color="#777" onPress={clearFilters} style={styles.actionBtn} />
            <AppButton
              title="Пошук"
              onPress={() => {
                fetchOrders();
                connectWs();
                setFiltersVisible(false);
              }}
              style={styles.actionBtn}
            />
          </View>
          <AppButton title="Закрити" color="#333" onPress={() => setFiltersVisible(false)} style={styles.closeBtn} />
        </ScrollView>
      </SafeAreaView>
      </Modal>
          <FlatList
            ref={listRef}
            data={orders}
            renderItem={renderItem}
            keyExtractor={(o) => o.id.toString()}
            onRefresh={refresh}
            refreshing={refreshing}
            ListEmptyComponent={
              loading ? (
                <View style={styles.empty}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <OrderCardSkeleton key={i} />
                  ))}
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function parseNumber(v) {
  if (v === null || v === undefined) return NaN;
  return parseFloat(String(v).replace(',', '.'));
}

const styles = StyleSheet.create({
  filters: {
    padding: 16,
  },
  input: {
    marginVertical: 4,
    width: '100%',
  },
  toggle: { marginVertical: 8, width: '100%' },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexBasis: '100%',
  },
  radiusButton: { flex: 1, marginHorizontal: 4 },
  radiusInput: { flex: 2, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', flexBasis: '100%', marginTop: 8 },
  actionBtn: { flex: 1, marginHorizontal: 4 },
  closeBtn: { marginTop: 8 },
  modalContainer: { flex: 1 },
  empty: { paddingVertical: 8 },
  listContent: { paddingBottom: 260 },
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
