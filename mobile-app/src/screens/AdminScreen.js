import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import Skeleton from '../components/Skeleton';

export default function AdminScreen() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch('/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(data);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setLoading(false);
      }
    }
    load();
  }, []);

  async function block(id) {
    await apiFetch(`/admin/users/${id}/block`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  function renderItem({ item }) {
    return (
      <View style={styles.item}>
        <Text>{item.name} ({item.role})</Text>
        {item.role === 'DRIVER' && (
          <Button title={item.blocked ? 'Unblock' : 'Block'} onPress={() => block(item.id)} />
        )}
      </View>
    );
  }

  if (loading && users.length === 0) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} style={styles.skelLine} />
        ))}
      </View>
    );
  }

  return (
    <FlatList data={users} renderItem={renderItem} keyExtractor={u => u.id.toString()} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  item: { padding: 12, borderBottomWidth: 1 },
  skelLine: { height: 20, marginVertical: 8 }
});
