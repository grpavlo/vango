import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';

export default function BalanceScreen({ route }) {
  const { token } = route.params;
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch('/finance/balance', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBalance(data.balance);
      } catch (err) {
        console.log(err);
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
