import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Modal,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppButton from '../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, HOST_URL } from '../api';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';
import StatusTimeline from '../components/StatusTimeline';

const statusLabels = {
  CREATED: 'Створено',
  ACCEPTED: 'Водій в дорозі',
  IN_PROGRESS: 'Водій отримав вантаж',
  DELIVERED: 'Замовлення доставлено',
  COMPLETED: 'Виконано',
  PENDING: 'Очікує підтвердження',
  CANCELLED: 'Скасовано',
};

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => (n < 10 ? `0${n}` : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OrderDetailScreen({ route, navigation }) {
  const { order } = route.params;
  const [previewIndex, setPreviewIndex] = useState(null);
  const { token, role } = useAuth();
  const [phone, setPhone] = useState(null);
  const [customerName, setCustomerName] = useState(null);
  const [reserved, setReserved] = useState(false);
  const [reservedUntil, setReservedUntil] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);


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
      await apiFetch(`/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      navigation.navigate('Main', { screen: 'MyOrders' });
    } catch (err) {
      console.log(err);
    }
  }


  async function reserve() {
    try {
      const data = await apiFetch(`/orders/${order.id}/reserve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
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

  async function updateStatus(id, status) {
    try {
      const updated = await apiFetch(`/orders/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      Object.assign(order, updated);
    } catch (err) {
      console.log(err);
    }
  }

  async function markReceived(id) {
    if (await confirmAction('Підтвердити отримання вантажу?')) {
      updateStatus(id, 'IN_PROGRESS');
    }
  }

  async function markDelivered(id) {
    if (await confirmAction('Підтвердити передачу вантажу?')) {
      updateStatus(id, 'DELIVERED');
    }
  }

  async function confirmDelivery(id) {
    if (await confirmAction('Підтвердити виконання замовлення?')) {
      updateStatus(id, 'COMPLETED');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {reserved && timeLeft !== null && (
        <View style={styles.fixedTimer}>
          <Text style={styles.timerText}>
            {String(Math.floor(timeLeft / 60000)).padStart(2, '0')}:
            {String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0')}
          </Text>
        </View>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        {role === 'CUSTOMER' && !order.driverId && (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={edit} style={styles.iconButton}>
              <Ionicons name="pencil" size={28} color={colors.green} />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDelete} style={styles.iconButton}>
              <Ionicons name="trash" size={28} color="red" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={styles.title}>Замовлення № {order.id}</Text>
      {role === 'CUSTOMER' && (order.driver || order.reservedDriver || order.candidateDriver) && (
        <View style={styles.driverCard}>
          <View style={styles.driverRow}>
            <Ionicons name="person-circle" size={36} color={colors.green} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text>{(order.driver || order.reservedDriver || order.candidateDriver).name}</Text>
              {(order.driver || order.reservedDriver || order.candidateDriver).rating && (
                <Text>Рейтинг: {(order.driver || order.reservedDriver || order.candidateDriver).rating.toFixed(1)}</Text>
              )}
            </View>
            {(order.driver || order.reservedDriver || order.candidateDriver).phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${(order.driver || order.reservedDriver || order.candidateDriver).phone}`)}>
                <Ionicons name="call" size={28} color={colors.green} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {order.history && order.history.length > 0 && (
        <StatusTimeline
          history={order.history.map((h) => ({
            ...h,
            label: statusLabels[h.status] || h.status,
          }))}
        />
      )}
      <View style={styles.detailsCard}>
      <View style={styles.row}>
        <Ionicons name="pin-outline" size={20} color={colors.orange} style={styles.rowIcon} />
        <Text style={styles.label}>Звідки:</Text>
        <Text style={styles.value}>{order.pickupLocation}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="flag-outline" size={20} color={colors.green} style={styles.rowIcon} />
        <Text style={styles.label}>Куди:</Text>
        <Text style={styles.value}>{order.dropoffLocation}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="cube-outline" size={20} color="#555" style={styles.rowIcon} />
        <Text style={styles.label}>Габарити:</Text>
        <Text style={styles.value}>{order.dimensions}</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="fitness-outline" size={20} color="#555" style={styles.rowIcon} />
        <Text style={styles.label}>Вага:</Text>
        <Text style={styles.value}>{order.weight}</Text>
      </View>
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
      {role === 'DRIVER' && order.status === 'ACCEPTED' && (
        <AppButton title="Отримав вантаж" onPress={() => markReceived(order.id)} />
      )}
      {role === 'DRIVER' && order.status === 'IN_PROGRESS' && (
        <AppButton title="Віддав вантаж" onPress={() => markDelivered(order.id)} />
      )}
      {role === 'CUSTOMER' && order.status === 'DELIVERED' && (
        <AppButton title="Підтвердити доставку" onPress={() => confirmDelivery(order.id)} />
      )}
      {role === 'DRIVER' && !order.driverId && (
        <View style={styles.bottomButtons}>
          {!reserved && <AppButton title="Резерв 10 хв" onPress={reserve} />}
          {reserved && (
            <View style={styles.reserveContainer}>
              <View style={styles.reserveRow}>
                <AppButton title="Відмінити резерв" onPress={cancelReserve} style={{ flex: 1 }} />
                {phone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.callBtn}>
                    <Ionicons name="call" size={32} color={colors.green} />
                    {customerName && (
                      <Text style={styles.nameText}>{customerName}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          <AppButton title="Взяти" color={colors.orange} onPress={accept} />
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 24 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  label: { fontWeight: 'bold', marginRight: 8, fontSize: 16 },
  value: { fontSize: 16, flexShrink: 1 },
  rowIcon: { marginRight: 6 },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  photo: { width: 120, height: 120, marginRight: 8 },
  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  full: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  callBtn: { padding: 8, flexDirection: 'row', alignItems: 'center' },
  bottomButtons: { marginTop: 'auto' },
  reserveContainer: { marginBottom: 8 },
  reserveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
  nameText: { marginLeft: 4, fontSize: 16 },
});

