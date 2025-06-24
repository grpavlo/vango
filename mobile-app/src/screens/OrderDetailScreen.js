import React from 'react';
import { View, Text, Button, StyleSheet, Alert, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, API_URL } from '../api';
import { colors } from '../components/Colors';
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
      <Text>Звідки: {order.pickupLocation}</Text>
      <Text>Куди: {order.dropoffLocation}</Text>
      <Text>Габарити: {order.dimensions}</Text>
      <Text>Вага: {order.weight}</Text>
      <Text>Ціна: {Math.round(order.price)} грн</Text>
      {order.photos && order.photos.length > 0 && (
        <ScrollView horizontal style={{ marginVertical: 8 }}>
          {order.photos.map((p, i) => (
            <Image key={i} source={{ uri: `${API_URL}${p}` }} style={styles.photo} />
          ))}
        </ScrollView>
      )}
      {role === 'DRIVER' && !order.driverId && (
        <Button title="Прийняти" onPress={accept} />
      )}
      {order.driverId && <Button title="У вибране" onPress={addFavorite} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 },
  photo: { width: 120, height: 120, marginRight: 8 }
});
