import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { apiFetch } from '../api';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState(null);

  async function handleRegister() {
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city })
      });
      Alert.alert('Успіх', 'Реєстрація успішна', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err) {
      const msg = err.message || 'Помилка реєстрації';
      setError(msg);
      Alert.alert('Помилка', msg);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ім\'я</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Text style={styles.label}>Електронна пошта</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Text style={styles.label}>Пароль</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      <Text style={styles.label}>Місто</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonContainer}>
        <Button title="Зареєструватися" color="#2ecc71" onPress={handleRegister} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { marginTop: 8, color: '#e67e22' },
  input: { borderWidth: 1, borderColor: '#2ecc71', padding: 8, borderRadius: 4 },
  error: { color: 'red', marginTop: 8 },
  buttonContainer: { marginTop: 16 }
});
