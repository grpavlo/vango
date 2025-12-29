import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import Skeleton from '../components/Skeleton';

export default function BalanceScreen() {
  const { token } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch('/finance/balance', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBalance(data.balance);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setLoading(false);
      }
    }
    load();
  }, []);

  async function withdraw() {
    await apiFetch('/finance/withdraw', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: balance })
    });
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Skeleton style={{ width: 120, height: 20 }} />
        <Skeleton style={{ width: 80, height: 36, marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Balance: {balance}</Text>
      <Button title="Withdraw" onPress={withdraw} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
