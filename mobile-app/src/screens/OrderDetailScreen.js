import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppButton from '../components/AppButton';

import AppInput from '../components/AppInput';

import { Ionicons } from '@expo/vector-icons';

import { apiFetch, HOST_URL } from '../api';

import { colors } from '../components/Colors';

import { useAuth } from '../AuthContext';

import StatusTimeline from '../components/StatusTimeline';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import AppText from '../components/AppText';

import Screen from '../components/Screen';



const statusLabels = {

  CREATED: 'Створено',

  ACCEPTED: 'Водій в дорозі',

  IN_PROGRESS: 'Водій отримав вантаж',

  DELIVERED: 'Замовлення доставлено',

  COMPLETED: 'Виконано',

  PENDING: 'Очікує підтвердження',

  CANCELLED: 'Скасовано',

  REJECTED: 'Відмовлено',

};





const historyActorLabels = {

  DRIVER: 'Водій',

  CUSTOMER: 'Замовник',

  BOTH: 'Користувач',

};



const priceFieldLabels = {

  finalPrice: 'фінальну ціну',

  price: 'ціну',

};



function statusColor(status) {

  switch (status) {

    case 'CREATED':

      return colors.green;

    case 'PENDING':

      return '#FBBF24';

    case 'REJECTED':

    case 'CANCELLED':

      return colors.red;

    case 'COMPLETED':

      return colors.gray900;

    default:

      return colors.green;

  }

}



function formatTime(dateStr) {

  const d = toUtcPlus2(dateStr);

  const pad = (n) => (n < 10 ? `0${n}` : n);

  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

}



function formatDate(dateStr) {

  const d = toUtcPlus2(dateStr);

  const pad = (n) => (n < 10 ? `0${n}` : n);

  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`;

}

function toUtcPlus2(value) {

  if (!value) return new Date(NaN);

  const d = value instanceof Date ? value : new Date(value);

  const utcTime = d.getTime();

  // Фіксований пояс UTC+2 для всього застосунку

  return new Date(utcTime + 2 * 60 * 60 * 1000);

}

function formatDateTimeUtc2(value) {

  const d = toUtcPlus2(value);

  if (Number.isNaN(d.getTime())) return '';

  const pad = (n) => (n < 10 ? `0${n}` : n);

  const date = `${pad(d.getUTCDate())}.${pad(

    d.getUTCMonth() + 1

  )}.${d.getUTCFullYear()}`;

  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  return `${date} ${time}`;

}



function calcVolume(dimensions) {

  if (!dimensions) return null;

  const parts = dimensions.split('x').map((n) => parseFloat(n));

  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;

  return parts[0] * parts[1] * parts[2];

}



function fullPhotoUrl(path) {

  if (!path) return null;

  if (/^https?:/i.test(path)) return path;

  return `${HOST_URL}${path}`;

}





function formatPriceValue(value) {

  if (value === null || value === undefined) return null;

  const num = Number(value);

  if (!Number.isFinite(num)) return null;

  return `${Math.round(num).toLocaleString('uk-UA')} грн`;

}



function formatHistoryEntries(history) {

  if (!Array.isArray(history)) return [];

  return history.map((entry) => {

    if (entry.status === 'PRICE_UPDATED') {

      const actor =

        historyActorLabels[entry.changedByRole] ||

        (entry.changedByRole ? 'Користувач' : 'Система');

      const fieldLabel =

        priceFieldLabels[entry.field] || priceFieldLabels.price;

      const from = formatPriceValue(entry.fromPrice);

      const to = formatPriceValue(entry.toPrice);

      let label;

      if (from && to) {

        label = `${actor} змінив ${fieldLabel} з ${from} на ${to}`;

      } else if (to) {

        label = `${actor} встановив ${fieldLabel} ${to}`;

      } else {

        label = `${actor} змінив ${fieldLabel}`;

      }

      return { ...entry, label };

    }

    return {

      ...entry,

      label: entry.label || statusLabels[entry.status] || entry.status,

    };

  });

}



export default function OrderDetailScreen({ route, navigation }) {

  const params = route?.params ?? {};

  const initialOrder = params.order ?? null;

  const orderId = params.orderId ?? params.order?.id ?? null;

  const [order, setOrder] = useState(initialOrder);

  const [previewIndex, setPreviewIndex] = useState(null);

  const { token, role } = useAuth();

  const [phone, setPhone] = useState(null);

  const [customerName, setCustomerName] = useState(null);

  const [reserved, setReserved] = useState(false);

  const [reservedUntil, setReservedUntil] = useState(null);

  const [timeLeft, setTimeLeft] = useState(null);

  const [actionHeight, setActionHeight] = useState(0);

  const [finalPrice, setFinalPrice] = useState(

    order?.price ? String(order.price) : ''

  );

  const wsRef = useRef(null);

  const priceInputRef = useRef(null);

  const contactPhone = order

    ? phone || (order.customer ? order.customer.phone : null)

    : phone;

  const contactName = order

    ? customerName || (order.customer ? order.customer.name : null)

    : customerName;

  const showContact = Boolean(order && (order.reservedBy || order.driverId));

  const assignedDriver = useMemo(() => {

    if (!order) return null;

    return order.driver || order.reservedDriver || order.candidateDriver || null;

  }, [order?.driver, order?.reservedDriver, order?.candidateDriver]);

  const driverPhotoUri = useMemo(

    () => fullPhotoUrl(assignedDriver?.driverProfile?.selfiePhoto),

    [assignedDriver?.driverProfile?.selfiePhoto]

  );

  const openDriverProfile = useCallback(() => {

    if (!assignedDriver) return;

    navigation.navigate('DriverProfile', { driver: assignedDriver });

  }, [assignedDriver, navigation]);

  const volume = order ? calcVolume(order.dimensions) : null;



  const formattedHistory = useMemo(

    () => formatHistoryEntries(order?.history),

    [order?.history]

  );



  useEffect(() => {

  connectWs();

  return () => {

    if (wsRef.current) wsRef.current.close();

  };

}, [token]);



  useEffect(() => {

    setFinalPrice(order?.price ? String(order.price) : '');

  }, [order?.price]);



  function connectWs() {

    if (!token) return;

    if (wsRef.current) wsRef.current.close();

    const url = `${HOST_URL.replace(/^http/, 'ws')}/api/orders/stream`;

    const ws = new WebSocket(url, null, {

      headers: { Authorization: `Bearer ${token}` },

    });

    wsRef.current = ws;

    ws.onmessage = (ev) => {

      try {

        const data = JSON.parse(ev.data);

        const id = initialOrder ? initialOrder.id : orderId;

        if (data.id === id) {

          setOrder(data);

        }

      } catch (e) {

        console.log('ws message error', e);

      }

    };

    ws.onerror = (e) => console.log('ws error', e.message);

  }



  useEffect(() => {

    async function fetchOrder() {

      try {

        const id = initialOrder ? initialOrder.id : orderId;

        const data = await apiFetch(`/orders/${id}`, {

          headers: { Authorization: `Bearer ${token}` },

        });

        setOrder(data);

      } catch (err) {

        console.log(err);

      }

    }

    fetchOrder();

    const sub = navigation.addListener('focus', fetchOrder);

    return sub;

  }, [initialOrder && initialOrder.id, orderId, navigation, token]);





  useEffect(() => {

    if (order.reservedBy && order.reservedUntil) {

      const until = new Date(order.reservedUntil);

      if (until > new Date()) setReserved(true);

      setReservedUntil(until);

    }

  }, [order]);



  useEffect(() => {

    async function loadPhone() {

      if (reserved && !phone) {

        try {

          const stored = await AsyncStorage.getItem('reservedPhones');

          if (stored) {

            const map = JSON.parse(stored);

            if (map[order.id]) {

              setPhone(map[order.id].phone);

              setCustomerName(map[order.id].name);

            }

          }

        } catch {}

      }

    }

    loadPhone();

  }, [reserved, phone, order.id]);



  useEffect(() => {

    let interval;

    if (reserved && reservedUntil) {

      const update = () => {

        const diff = reservedUntil - new Date();

        if (diff <= 0) {

          clearInterval(interval);

          cancelReserve();

        } else {

          setTimeLeft(diff);

        }

      };

      update();

      interval = setInterval(update, 1000);

    }

    return () => clearInterval(interval);

  }, [reserved, reservedUntil]);





  async function accept() {

    try {

      // Водій може встановлювати фінальну ціну ТІЛЬКИ якщо agreedPrice === true

      const payload =

        order.agreedPrice &&

        finalPrice !== '' && !Number.isNaN(Number(finalPrice))

          ? { finalPrice: String(Math.round(Number(finalPrice))) }

          : {};

      const options = {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` }

      };

      if (Object.keys(payload).length) {

        options.body = JSON.stringify(payload);

      }

      await apiFetch(`/orders/${order.id}/accept`, options);

      navigation.navigate('Main', { screen: 'MyOrders' });

    } catch (err) {

      console.log(err);

    }

  }





  async function reserve() {

    try {

      // Водій може встановлювати фінальну ціну ТІЛЬКИ якщо agreedPrice === true

      const payload =

        order.agreedPrice &&

        finalPrice !== '' && !Number.isNaN(Number(finalPrice))

          ? { finalPrice: String(Math.round(Number(finalPrice))) }

          : {};

      const options = {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` }

      };

      if (Object.keys(payload).length) {

        options.body = JSON.stringify(payload);

      }

      const data = await apiFetch(`/orders/${order.id}/reserve`, options);

      setReserved(true);

      setPhone(data.phone);

      setCustomerName(data.name);

      try {

        const stored = await AsyncStorage.getItem('reservedPhones');

        const map = stored ? JSON.parse(stored) : {};

        if (data.phone) {

          map[order.id] = { phone: data.phone, name: data.name };

          await AsyncStorage.setItem('reservedPhones', JSON.stringify(map));

        }

      } catch {}

      if (data.order && data.order.reservedUntil)

        setReservedUntil(new Date(data.order.reservedUntil));

    } catch (err) {

      console.log(err);

    }

  }



  async function cancelReserve() {

    try {

      await apiFetch(`/orders/${order.id}/cancel-reserve`, {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` },

      });

      setReserved(false);

      setPhone(null);

      setCustomerName(null);

      setReservedUntil(null);

      setTimeLeft(null);

      try {

        const stored = await AsyncStorage.getItem('reservedPhones');

        const map = stored ? JSON.parse(stored) : {};

        if (map[order.id]) {

          delete map[order.id];

          await AsyncStorage.setItem('reservedPhones', JSON.stringify(map));

        }

      } catch {}

      navigation.goBack();

    } catch (err) {

      console.log(err);

    }

  }



  async function remove() {

    try {

      await apiFetch(`/orders/${order.id}`, {

        method: 'DELETE',

        headers: { Authorization: `Bearer ${token}` },

      });

      navigation.goBack();

    } catch (err) {

      console.log(err);

    }

  }



  function edit() {

    navigation.navigate('EditOrder', { order });

  }



  function confirmDelete() {

    Alert.alert('Підтвердження', 'Видалити вантаж?', [

      { text: 'Скасувати' },

      { text: 'OK', onPress: remove },

    ]);

  }



  function confirmAction(message) {

    return new Promise((resolve) => {

      Alert.alert('Підтвердження', message, [

        { text: 'Скасувати', onPress: () => resolve(false) },

        { text: 'OK', onPress: () => resolve(true) },

      ]);

    });

  }



  async function updateStatus(id, status, options = {}) {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let body;
      if (options.photoUri) {
        const fd = new FormData();
        fd.append('status', status);
        const uri = options.photoUri;
        const filenameFromUri = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const extMatch = /\.(\w+)$/.exec(filenameFromUri);
        const normalizedName = extMatch ? filenameFromUri : `${filenameFromUri}.jpg`;
        const ext = (extMatch ? extMatch[1] : 'jpg').toLowerCase();
        const mime =
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'jpeg'}`;
        fd.append('statusPhoto', {
          uri,
          name: normalizedName,
          type: mime,
        });
        body = fd;
      } else {
        body = JSON.stringify({ status });
      }
      const updated = await apiFetch(`/orders/${id}/status`, {
        method: 'PATCH',
        headers,
        body,
      });
      setOrder(updated);
      return updated;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  function openLocationInMaps(address, lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const hasCoords =
      lat !== undefined &&
      lat !== null &&
      lon !== undefined &&
      lon !== null &&
      `${lat}` !== '' &&
      `${lon}` !== '' &&
      Number.isFinite(latNum) &&
      Number.isFinite(lonNum);
    const query = address || (hasCoords ? `${latNum},${lonNum}` : '');
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const coord = hasCoords ? `${latNum},${lonNum}` : null;
    const url = coord
      ? Platform.select({
          ios: `http://maps.apple.com/?ll=${coord}&q=${encoded}`,
          default: `geo:${coord}?q=${encoded}`,
        })
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url).catch((err) => console.log('maps open error', err));
  }

  function askPhotoPrompt(message) {
    return new Promise((resolve) => {
      Alert.alert('Фото вантажу', message, [
        { text: 'Пропустити', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Зробити фото', onPress: () => resolve(true) },
      ]);
    });
  }

  async function captureStatusPhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Доступ до камери', 'Надайте доступ до камери, щоб додати фото.');
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
      });
      if (result.canceled) return null;
      return result.assets?.[0]?.uri || null;
    } catch (err) {
      console.log(err);
      Alert.alert('Помилка', 'Не вдалося зробити фото.');
      return null;
    }
  }

  async function changeStatusWithOptionalPhoto(id, status, promptMessage) {
    const wantsPhoto = await askPhotoPrompt(promptMessage);
    if (wantsPhoto) {
      const photoUri = await captureStatusPhoto();
      if (photoUri) {
        await updateStatus(id, status, { photoUri });
        return;
      }
    }
    await updateStatus(id, status);
  }


  async function markReceived(id) {
    if (await confirmAction('Підтвердити отримання вантажу?')) {
      await changeStatusWithOptionalPhoto(
        id,
        'IN_PROGRESS',
        'Бажаєте додати фото отриманого вантажу?'
      );
    }
  }

  async function markDelivered(id) {
    if (await confirmAction('Підтвердити передачу вантажу?')) {
      await changeStatusWithOptionalPhoto(
        id,
        'DELIVERED',
        'Бажаєте додати фото виданого вантажу?'
      );
    }
  }

  async function confirmDelivery(id) {
    if (await confirmAction('Підтвердити виконання замовлення?')) {
      await updateStatus(id, 'COMPLETED');
    }
  }


  async function confirmDriver() {

    try {

      const updated = await apiFetch(`/orders/${order.id}/confirm-driver`, {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` },

      });

      setOrder(updated);

    } catch (err) {

      console.log(err);

    }

  }



  async function rejectDriver() {

    try {

      const updated = await apiFetch(`/orders/${order.id}/reject-driver`, {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` },

      });

      setOrder(updated);

    } catch (err) {

      console.log(err);

    }

  }



  function renderActions() {

    const buttons = [];



    if (role === 'DRIVER' && !order.driverId) {

      if (!reserved) {

        buttons.push(

          <AppButton key="reserve" title="Резерв 10 хв" onPress={reserve} variant="success" />

        );

      } else {

        buttons.push(

          <AppButton key="cancel" title="Відмінити резерв" onPress={cancelReserve} variant="danger" />

        );

      }

      buttons.push(

        <AppButton key="take" title="Взяти" onPress={accept} variant="warning" />

      );

    }



    if (role === 'DRIVER' && order.status === 'ACCEPTED') {

      buttons.push(

        <AppButton key="received" title="Отримав вантаж" onPress={() => markReceived(order.id)} />

      );

    }



    if (role === 'DRIVER' && order.status === 'IN_PROGRESS') {

      buttons.push(

        <AppButton key="delivered" title="Віддав вантаж" onPress={() => markDelivered(order.id)} />

      );

    }



    if (role === 'CUSTOMER') {

      if (order.status === 'DELIVERED') {

        buttons.push(

          <AppButton key="confirm" title="Підтвердити доставку" onPress={() => confirmDelivery(order.id)} />

        );

      } else if (order.status === 'PENDING') {

        buttons.push(

          <View key="pending" style={styles.actionRow}>

            <AppButton title="Прийняти" onPress={confirmDriver} style={styles.smallBtn} />

            <AppButton title="Відхилити" onPress={rejectDriver} variant="danger" style={styles.smallBtn} />

          </View>

        );

      } else if (order.status === 'CREATED' && order.reservedBy) {

        buttons.push(

          <AppButton key="cancel-reserve" title="Відмінити резерв" onPress={cancelReserve} variant="danger" />

        );

      }

    }



    return buttons.length > 0 ? buttons : <View style={{ height: 24 }} />;

  }



  if (!order) {

    return (

      <SafeAreaView style={styles.container}>

        <ActivityIndicator size="large" color={colors.green} />

      </SafeAreaView>

    );

  }



  const actions = renderActions();

  const hasFooter =

    actions.length > 0 ||

    (role === 'DRIVER' && showContact && contactPhone) ||

    role === 'DRIVER';



  return (

    <Screen hasFooter={hasFooter}>

      <SafeAreaView style={styles.container}>

      {reserved && timeLeft !== null && (

        <View style={styles.fixedTimer}>

          <Text style={styles.timerText}>

            {String(Math.floor(timeLeft / 60000)).padStart(2, '0')}:

            {String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}

          </Text>

        </View>

      )}

      <ScrollView contentContainerStyle={{ paddingBottom: actionHeight + 16 }}>

      <View style={styles.appBar}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>

          <Ionicons name="arrow-back" size={24} color="#111827" />

        </TouchableOpacity>

        <Text style={styles.title}>Замовлення № {order.id}</Text>

        {role === 'CUSTOMER' && !order.driverId ? (

          <View style={styles.appActions}>

            <TouchableOpacity onPress={edit} style={styles.iconButton}>

              <Ionicons name="pencil" size={20} color={colors.green} />

            </TouchableOpacity>

            <TouchableOpacity onPress={confirmDelete} style={styles.iconButton}>

              <Ionicons name="trash" size={20} color={colors.red} />

            </TouchableOpacity>

          </View>

        ) : (

          <View style={{ width: 44 }} />

        )}

      </View>



      <View style={styles.statusCard}>

        <Text style={styles.statusDate}>
          {formatDateTimeUtc2(order.createdAt)}
        </Text>

        <View style={styles.statusRowCard}>

          <View style={[styles.statusDot, { backgroundColor: statusColor(order.status) }]} />

          <Text style={[styles.statusValue, { color: statusColor(order.status) }]}>

            {statusLabels[order.status] || order.status}

          </Text>

        </View>

      </View>



      {role === 'DRIVER' && showContact && contactPhone && (

        <View style={styles.driverCard}>

          <View style={styles.driverRow}>

            <Ionicons name="person-circle" size={36} color={colors.green} />

            <View style={{ marginLeft: 8, flex: 1 }}>

              <Text>{contactName || 'Замовник'}</Text>

            </View>

            <TouchableOpacity onPress={() => Linking.openURL(`tel:${contactPhone}`)}>

              <Ionicons name="call" size={28} color={colors.green} />

            </TouchableOpacity>

          </View>

        </View>

      )}



      {role === 'CUSTOMER' && assignedDriver && (

        <View style={styles.driverCard}>

          <View style={styles.driverRow}>

            <TouchableOpacity

              style={{ marginRight: 12 }}

              onPress={openDriverProfile}

              activeOpacity={0.8}

            >

              {driverPhotoUri ? (

                <Image

                  source={{ uri: driverPhotoUri }}

                  style={{ width: 48, height: 48, borderRadius: 24 }}

                />

              ) : (

                <Ionicons name="person-circle" size={48} color={colors.green} />

              )}

            </TouchableOpacity>

            <View style={{ flex: 1 }}>

              <Text>{assignedDriver.name}</Text>

              {assignedDriver.rating && (

                <Text>Рейтинг: {assignedDriver.rating.toFixed(1)}</Text>

              )}

            </View>

            {assignedDriver.phone && (

              <TouchableOpacity onPress={() => Linking.openURL(`tel:${assignedDriver.phone}`)}>

                <Ionicons name="call" size={28} color={colors.green} />

              </TouchableOpacity>

            )}

          </View>

        </View>

      )}



      {role !== 'DRIVER' && formattedHistory.length > 0 && (

        <StatusTimeline history={formattedHistory} />

      )}

      <View style={styles.detailsCard}>

      <View style={styles.row}>

        <Ionicons name="pin-outline" size={20} color={colors.orange} style={styles.rowIcon} />

        <View style={styles.rowText}>

          <Text style={styles.label}>Звідки:</Text>

          <Text style={styles.value}>{order.pickupLocation}</Text>

        </View>

        <TouchableOpacity

          style={styles.mapIconBtn}

          onPress={() =>

            openLocationInMaps(order.pickupLocation, order.pickupLat, order.pickupLon)

          }

          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

        >

          <Ionicons name="navigate-outline" size={20} color={colors.orange} />

        </TouchableOpacity>

      </View>

      <View style={styles.row}>

        <Ionicons name="flag-outline" size={20} color={colors.green} style={styles.rowIcon} />

        <View style={styles.rowText}>

          <Text style={styles.label}>Куди:</Text>

          <Text style={styles.value}>{order.dropoffLocation}</Text>

        </View>

        <TouchableOpacity

          style={styles.mapIconBtn}

          onPress={() =>

            openLocationInMaps(order.dropoffLocation, order.dropoffLat, order.dropoffLon)

          }

          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

        >

          <Ionicons name="navigate-outline" size={20} color={colors.green} />

        </TouchableOpacity>

      </View>


      {/* <View style={styles.row}>

        <Ionicons name="cube-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Габарити:</Text>

        <Text style={styles.value}>{order.dimensions}</Text>

      </View> */}

      {/* <View style={styles.row}>

        <Ionicons name="fitness-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Вага:</Text>

        <Text style={styles.value}>{order.weight}</Text>

      </View> */}

      {/* <View style={styles.row}>

        <Ionicons name="cube-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Об'єм:</Text>

        <Text style={styles.value}>{volume !== null ? volume.toFixed(2) : '?'} м³</Text>

      </View> */}

      <View style={styles.row}>

        <Ionicons name="time-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Завантаження:</Text>

        <Text style={styles.value}>

          {formatDate(order.loadFrom)} {formatTime(order.loadFrom)} - {formatTime(order.loadTo)}

        </Text>

      </View>

      <View style={styles.row}>

        <Ionicons name="time-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Вивантаження:</Text>

        <Text style={styles.value}>

          {formatDate(order.unloadFrom)} {formatTime(order.unloadFrom)} - {formatTime(order.unloadTo)}

        </Text>

      </View>

      <View style={styles.row}>

        <Ionicons name={order.payment === 'card' ? 'card-outline' : 'cash-outline'} size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Оплата:</Text>

        <Text style={styles.value}>{order.payment === 'card' ? 'Карта' : 'Готівка'}</Text>

      </View>

      <View style={styles.row}>

        <Ionicons name="arrow-down-circle-outline" size={20} color={colors.orange} style={styles.rowIcon} />

        <Text style={styles.label}>Завантаження допомога:</Text>

        <Text style={styles.value}>{order.loadHelp ? 'так' : 'ні'}</Text>

      </View>

      <View style={styles.row}>

        <Ionicons name="arrow-up-circle-outline" size={20} color={colors.orange} style={styles.rowIcon} />

        <Text style={styles.label}>Розвантаження допомога:</Text>

        <Text style={styles.value}>{order.unloadHelp ? 'так' : 'ні'}</Text>

      </View>

      <View style={styles.row}>

        <Ionicons name="pricetag-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Ціна:</Text>

        <Text style={styles.value}>{Math.round(order.price)} грн</Text>

      </View>

      <View style={styles.row}>

        <Ionicons name="information-circle-outline" size={20} color="#555" style={styles.rowIcon} />

        <Text style={styles.label}>Статус:</Text>

        <Text style={styles.value}>{statusLabels[order.status] || order.status}</Text>

      </View>

      {order.cargoType && (

        <View style={styles.row}>

          <Ionicons name="reader-outline" size={20} color="#555" style={styles.rowIcon} />

          <Text style={styles.label}>Опис:</Text>

          <Text style={styles.value}>{order.cargoType}</Text>

        </View>

      )}

      {order.photos && order.photos.length > 0 && (

        <ScrollView horizontal style={{ marginVertical: 8 }}>

          {order.photos.map((p, i) => (

            <TouchableOpacity key={i} onPress={() => setPreviewIndex(i)}>

              <Image source={{ uri: `${HOST_URL}${p}` }} style={styles.photo} />

            </TouchableOpacity>

          ))}

        </ScrollView>

      )}

      {previewIndex !== null && (

        <Modal visible transparent>

          <View style={styles.modal}>

            <TouchableOpacity style={styles.close} onPress={() => setPreviewIndex(null)}>

              <Ionicons name="close" size={32} color="#fff" />

            </TouchableOpacity>

            <Image

              source={{ uri: `${HOST_URL}${order.photos[previewIndex]}` }}

              style={styles.full}

              resizeMode="contain"

            />

          </View>

        </Modal>

      )}

      </View>

      {role === 'DRIVER' && formattedHistory.length > 0 && (

        <StatusTimeline history={formattedHistory} />

      )}

      

      </ScrollView>

        <View style={styles.actionArea} onLayout={(e) => setActionHeight(e.nativeEvent.layout.height)}>

      { role === 'DRIVER' && showContact && contactPhone && (

        <View style={styles.driverCard}>

          <View style={styles.driverRow}>

            <Ionicons name="person-circle" size={36} color={colors.green} />

            <View style={{ marginLeft: 8, flex: 1 }}>

              <Text>{contactName || 'Замовник'}</Text>
            </View>

            <TouchableOpacity onPress={() => Linking.openURL(`tel:${contactPhone}`)}>

              <Ionicons name="call" size={28} color={colors.green} />

            </TouchableOpacity>

          </View>

        </View>

      )}

      {actions}

      {role === 'DRIVER' && (

        <KeyboardAwareScrollView

          enableOnAndroid

          keyboardShouldPersistTaps="handled"

          extraScrollHeight={200}

          showsVerticalScrollIndicator={false}

        >

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>

            <AppText style={{ fontWeight: 'bold', marginRight: 8 }}>
              Фінальна ціна:
            </AppText>
            {order.agreedPrice ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>

              <AppInput

                ref={priceInputRef}

                style={{ flex: 1, height: 40 }}

                keyboardType="numeric"

                returnKeyType="done"

                placeholder="Введіть ціну"
                value={finalPrice}

                onChangeText={(t) => setFinalPrice(t.replace(/[^\d]/g, ''))}

              />

              <TouchableOpacity

                onPress={() => priceInputRef.current?.focus()}

                style={{ marginLeft: 4, padding: 4 }}

              >

                <Ionicons name="create-outline" size={20} color="#666" />

              </TouchableOpacity>

            </View>
            ) : (
              <AppText style={{ flex: 1, paddingHorizontal: 8 }}>
                {order.finalPrice
                  ? `${Math.round(Number(order.finalPrice))} грн`
                  : order.price
                  ? `${Math.round(Number(order.price))} грн`
                  : "—"}
              </AppText>
            )}

          </View>

        </KeyboardAwareScrollView>

      )}

        </View>

      </SafeAreaView>

    </Screen>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, padding: 16, paddingTop: 24 },

  iconButton: { padding: 10 },

  title: { fontSize: 18, fontWeight: '600', color: '#111827', textAlign: 'center' },

  row: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },

  rowText: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },

  label: { fontWeight: 'bold', marginRight: 8, fontSize: 16 },

  value: { fontSize: 16, flexShrink: 1 },

  rowIcon: { marginRight: 6 },

  mapIconBtn: { padding: 6 },

  detailsCard: {

    backgroundColor: '#fff',

    borderRadius: 16,

    padding: 20,

    marginTop: 16,

    marginBottom: 16,

    marginLeft:10,

    marginRight:10,

    shadowColor: '#000',

    shadowOpacity: 0.05,

    shadowOffset: { width: 0, height: 2 },

    shadowRadius: 4,

    elevation: 2,

  },

  photo: { width: 120, height: 120, marginRight: 8, marginLeft:10, marginRight:10, },

  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },

  full: { width: '100%', height: '100%' },

  close: { position: 'absolute', top: 40, right: 20, zIndex: 1 },

  driverCard: {

    backgroundColor: '#fff',

    borderRadius: 16,

    padding: 20,

    marginTop: 16,

    marginBottom: 16,

    marginLeft:10,

    marginRight:10,

    shadowColor: '#000',

    shadowOpacity: 0.05,

    shadowOffset: { width: 0, height: 2 },

    shadowRadius: 4,

    elevation: 2,

  },

  driverRow: { flexDirection: 'row', alignItems: 'center' },

  timer: { textAlign: 'right', fontSize: 16, color: colors.orange },

  fixedTimer: {

    position: 'absolute',

    top: 40,

    right: 16,

    backgroundColor: '#fff',

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 4,

    elevation: 3,

    zIndex: 2,

  },

  timerText: { fontSize: 16, color: colors.orange, fontWeight: 'bold' },

  nameText: { marginLeft: 4, fontSize: 16, marginLeft:10, marginRight:10 },

  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, marginLeft:10, marginRight:10  },

  appActions: { flexDirection: 'row' },

  statusCard: {

    backgroundColor: '#fff',

    borderRadius: 16,

    padding: 20,

    marginBottom: 16,

    marginLeft:10,

    marginRight:10,

    shadowColor: '#000',

    shadowOpacity: 0.05,

    shadowOffset: { width: 0, height: 2 },

    shadowRadius: 4,

    elevation: 2,

  },

  statusDate: { fontSize: 14, color: '#6B7280' },

  statusRowCard: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft:10, marginRight:10  },

  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8, marginLeft:10, marginRight:10  },

  statusValue: { fontSize: 18, fontWeight: '600' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },

  smallBtn: { flex: 1, marginHorizontal: 4 },

  actionArea: {

    position: 'absolute',

    left: 0,

    right: 0,

    bottom: 0,

    padding: 16,

    backgroundColor: '#fff',

    borderTopWidth: 1,

    borderTopColor: '#E5E7EB',

  },

});