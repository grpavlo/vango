import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import Skeleton from '../components/Skeleton';

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await apiFetch('/admin/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !data) {
    return (
      <View style={styles.container}>
        <Skeleton style={{ height: 20, marginVertical: 4, width: '60%' }} />
        <Skeleton style={{ height: 20, marginVertical: 4, width: '80%' }} />
        <Skeleton style={{ height: 20, marginVertical: 4, width: '70%' }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Average Price: {data.avgPrice}</Text>
      <Text>Delivered Orders: {data.deliveredCount}</Text>
      <Text>Average Delivery Time: {data.avgTime}</Text>
      <Text>Active Sessions: {data.activeSessions}</Text>
      <Text>Ended Sessions: {data.endedSessions}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 }
});
