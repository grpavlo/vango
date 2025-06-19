import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import PasswordInput from '../components/PasswordInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';
import { useToast } from '../components/Toast';

export default function RegisterScreen({ navigation }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setName('');
      setEmail('');
      setPassword('');
      setCity('');
      setError(null);
    });
    return unsubscribe;
  }, [navigation]);

  async function handleRegister() {
    if (!name || !email || !password) {
      toast.show('Заповніть всі поля');

      return;
    }
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city }),
      });
      toast.show('Реєстрація успішна');
      navigation.goBack();
    } catch (err) {
      const msg = err.message || 'Помилка реєстрації';
      setError(msg);
      toast.show(msg);

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
      <PasswordInput
        value={password}
        onChangeText={setPassword}
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
