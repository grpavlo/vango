import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function OrderDetailScreen({ route, navigation }) {
  const { order } = route.params;
  const { token, role } = useAuth();


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
    <View style={styles.container}>
      <Button title="Назад" onPress={() => navigation.goBack()} />
      <Text style={styles.title}>Замовлення № {order.id}</Text>
      <Text>Звідки: {order.pickupLocation}</Text>
      <Text>Куди: {order.dropoffLocation}</Text>
      <Text>Габарити: {order.dimensions}</Text>
      <Text>Вага: {order.weight}</Text>
      <Text>Ціна: {Math.round(order.price)} грн</Text>
      {role === 'DRIVER' && !order.driverId && (
        <Button title="Прийняти" onPress={accept} />
      )}
      {order.driverId && <Button title="У вибране" onPress={addFavorite} />}
      {role === 'CUSTOMER' && !order.driverId && (
        <>
          <Button title="Редагувати" onPress={edit} />
          <Button title="Видалити" color="red" onPress={confirmDelete} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 }
});
