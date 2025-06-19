import React, { useState } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState(null);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert('Помилка', 'Заповніть всі поля');
      return;
    }
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city }),
      });
      Alert.alert('Успіх', 'Реєстрація успішна', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      const msg = err.message || 'Помилка реєстрації';
      setError(msg);
      Alert.alert('Помилка', msg);
    }
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.label}>Ім'я</AppText>
      <AppInput value={name} onChangeText={setName} placeholder="Ваше ім'я" />
      <AppText style={styles.label}>Електронна пошта</AppText>
      <AppInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="example@email.com"
      />
      <AppText style={styles.label}>Пароль</AppText>
      <AppInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="********"
      />
      <AppText style={styles.label}>Місто</AppText>
      <AppInput value={city} onChangeText={setCity} placeholder="Київ" />
      {error && <AppText style={styles.error}>{error}</AppText>}
      <AppButton title="Зареєструватися" onPress={handleRegister} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  label: { marginTop: 8, color: colors.orange },
  error: { color: 'red', marginTop: 8 },
});
