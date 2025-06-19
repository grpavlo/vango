import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { apiFetch } from '../api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function handleLogin() {
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      Alert.alert('Успіх', 'Вхід виконано');
      navigation.navigate('Home', { token: data.token });
    } catch (err) {
      const msg = err.message || 'Помилка входу';
      setError(msg);
      Alert.alert('Помилка', msg);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Електронна пошта</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Text style={styles.label}>Пароль</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.buttonContainer}>
        <Button title="Увійти" color="#2ecc71" onPress={handleLogin} />
      </View>
      <View style={styles.buttonContainer}>
        <Button title="Реєстрація" color="#e67e22" onPress={() => navigation.navigate('Register')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { marginTop: 8, color: '#e67e22' },
  input: { borderWidth: 1, borderColor: '#2ecc71', padding: 8, borderRadius: 4 },
  error: { color: 'red', marginTop: 8 },
  buttonContainer: { marginTop: 8 }
});
