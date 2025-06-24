import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import Skeleton from '../components/Skeleton';

export default function FavoriteDriversScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch('/favorites', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDrivers(data);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setLoading(false);
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

  if (loading && drivers.length === 0) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} style={styles.skelLine} />
        ))}
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
  item: { padding: 12, borderBottomWidth: 1 },
  skelLine: { height: 20, margin: 12 }
});
