import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, TouchableOpacity, Image, ScrollView, SafeAreaView, Modal, Linking } from 'react-native';
import AppButton from '../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, HOST_URL } from '../api';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';

export default function OrderDetailScreen({ route, navigation }) {
  const { order } = route.params;
  const [previewIndex, setPreviewIndex] = useState(null);
  const { token, role } = useAuth();
  const [phone, setPhone] = useState(null);
  const [reserved, setReserved] = useState(false);

  useEffect(() => {
    if (order.reservedBy && order.reservedUntil) {
      const until = new Date(order.reservedUntil);
      if (until > new Date()) setReserved(true);
    }
  }, [order]);


  async function accept() {
    try {
      await apiFetch(`/orders/${order.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      navigation.navigate('Orders', { token });
    } catch (err) {
      console.log(err);
    }
  }

  async function addFavorite() {
    try {
      await apiFetch(`/favorites/${order.driverId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
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

  return (
    <SafeAreaView style={styles.container}>
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
      <View style={styles.row}>
        <Text style={styles.label}>Звідки:</Text>
        <Text style={styles.value}>{order.pickupLocation}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Куди:</Text>
        <Text style={styles.value}>{order.dropoffLocation}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Габарити:</Text>
        <Text style={styles.value}>{order.dimensions}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Вага:</Text>
        <Text style={styles.value}>{order.weight}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Ціна:</Text>
        <Text style={styles.value}>{Math.round(order.price)} грн</Text>
      </View>
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
      {role === 'DRIVER' && !order.driverId && (
        <View style={{ marginTop: 8 }}>
          {!reserved && <AppButton title="Резерв 10 хв" onPress={reserve} />}
          {reserved && (
            <View style={{ alignItems: 'center' }}>
              {phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.callBtn}>
                  <Ionicons name="call" size={32} color={colors.green} />
                </TouchableOpacity>
              )}
              <AppButton title="Відмінити резерв" onPress={cancelReserve} />
            </View>
          )}
          <AppButton title="Взяти" color={colors.orange} onPress={accept} />
        </View>
      )}
      {order.driverId && <Button title="У вибране" onPress={addFavorite} />}
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
  photo: { width: 120, height: 120, marginRight: 8 },
  modal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  full: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  callBtn: { padding: 8 }
});

