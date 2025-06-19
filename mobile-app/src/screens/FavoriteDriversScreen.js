import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function FavoriteDriversScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/favorites', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDrivers(data);
      } catch (err) {
        console.log(err);
      }
    }
    load();
  }, []);

  function renderItem({ item }) {
    return (
      <View style={styles.item}>
        <Text>Driver ID: {item.driverId}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList data={drivers} renderItem={renderItem} keyExtractor={(d) => d.id.toString()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { padding: 12, borderBottomWidth: 1 }
});
