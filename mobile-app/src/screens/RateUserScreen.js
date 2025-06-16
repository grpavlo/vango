import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { apiFetch } from '../api';

export default function RateUserScreen({ route }) {
  const { token, toUserId, orderId } = route.params;
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  async function submit() {
    await apiFetch('/ratings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ toUserId, orderId, rating: parseFloat(rating), comment })
    });
  }

  return (
    <View style={styles.container}>
      <Text>Rating</Text>
      <TextInput style={styles.input} value={rating} onChangeText={setRating} keyboardType="numeric" />
      <Text>Comment</Text>
      <TextInput style={styles.input} value={comment} onChangeText={setComment} />
      <Button title="Submit" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { borderWidth: 1, padding: 8, marginVertical: 4 }
});
