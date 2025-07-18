import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import PasswordInput from '../components/PasswordInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../AuthContext';

export default function LoginScreen({ navigation }) {
  const toast = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setEmail('');
      setPassword('');
      setError(null);
    });
    return unsubscribe;
  }, [navigation]);

  async function handleLogin() {
    if (!email || !password) {
      toast.show('Введіть email та пароль');

      return;
    }
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await login(data.token, data.role);
      toast.show('Вхід виконано');
      // Navigation is handled by root navigator based on auth state
    } catch (err) {
      const msg = err.message || 'Помилка входу';
      setError(msg);
      toast.show(msg);

    }
  }

  return (
    <View style={styles.container}>
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
      {error && <AppText style={styles.error}>{error}</AppText>}
      <AppButton title="Увійти" onPress={handleLogin} />
      <AppButton
        title="Реєстрація"
        color={colors.orange}
        onPress={() => navigation.navigate('Register')}
      />
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
  label: { marginTop: 8, color: colors.text },
  error: { color: 'red', marginTop: 8 },
});
