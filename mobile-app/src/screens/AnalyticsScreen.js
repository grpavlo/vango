import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res);
    }
    load();
  }, []);

  if (!data) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text>Average Price: {data.avgPrice}</Text>
      <Text>Delivered Orders: {data.deliveredCount}</Text>
      <Text>Average Delivery Time: {data.avgTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 }
});
