import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import AppText from '../components/AppText';
import AppInput from '../components/AppInput';
import PasswordInput from '../components/PasswordInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';
import { useToast } from '../components/Toast';
import { formatUaPhoneInput, isCompleteUaPhone } from '../phoneMask';

export default function RegisterScreen({ navigation }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState(formatUaPhoneInput(''));
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setName('');
      setEmail('');
      setPassword('');
      setCity('');
      setPhone(formatUaPhoneInput(''));
      setError(null);
    });
    return unsubscribe;
  }, [navigation]);

  async function handleRegister() {
    if (!name || !email || !password) {
      toast.show('Заповніть всі поля');

      return;
    }
    if (!isCompleteUaPhone(phone)) {
      toast.show('Вкажіть номер у форматі +380XXXXXXXXX');
      return;
    }
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, city, phone: phone.trim() }),
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
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={80}
      enableOnAndroid={true}
      showsVerticalScrollIndicator={false}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
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
          <AppText style={styles.label}>Телефон</AppText>
          <AppInput
            value={phone}
            onChangeText={(t) => setPhone(formatUaPhoneInput(t))}
            placeholder="+380XXXXXXXXX"
            keyboardType="phone-pad"
            maxLength={13}
          />
          <AppText style={styles.label}>Місто</AppText>
          <AppInput value={city} onChangeText={setCity} placeholder="Київ" />
          {error && <AppText style={styles.error}>{error}</AppText>}
          <AppButton title="Зареєструватися" onPress={handleRegister} />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  label: { marginTop: 8, color: colors.text },
  error: { color: 'red', marginTop: 8 },
});
