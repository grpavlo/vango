import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';

export default function AdminScreen() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await apiFetch('/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(data);
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

  return (
    <FlatList data={users} renderItem={renderItem} keyExtractor={u => u.id.toString()} />
  );
}

const styles = StyleSheet.create({
  item: { padding: 12, borderBottomWidth: 1 }
});
