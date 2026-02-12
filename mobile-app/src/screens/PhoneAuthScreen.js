import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import AppText from '../components/AppText';

let Clipboard = null;
try {
  Clipboard = require('expo-clipboard');
} catch {
  // Native module ExpoClipboard not available (потрібна перебудова після npx expo install expo-clipboard)
}
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../AuthContext';

function extractCodeFromClipboard(text) {
  const match = text?.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

export default function PhoneAuthScreen({ navigation }) {
  const toast = useToast();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [loading, setLoading] = useState(false);
  const codeRef = useRef('');

  function formatPhoneInput(text) {
    const digits = text.replace(/\D/g, '').slice(0, 12);
    if (digits.length <= 2) return digits ? `+${digits}` : '';
    if (digits.startsWith('38')) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `+38 ${digits}`;
  }

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.show('Введіть коректний номер телефону');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone: digits.startsWith('38') ? digits : '38' + digits }),
      });
      setStep('code');
      setCode('');
      toast.show('Код надіслано на ваш номер');
    } catch (err) {
      toast.show(err.message || 'Не вдалося надіслати код');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      toast.show('Введіть 6-значний код');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    const phoneStr = phoneDigits.startsWith('38') ? phoneDigits : '38' + phoneDigits;
    setLoading(true);
    try {
      const data = await apiFetch('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneStr, code: trimmed }),
      });
      await login(data.token, data.role);
      toast.show('Вхід виконано');
    } catch (err) {
      toast.show(err.message || 'Невірний код');
    } finally {
      setLoading(false);
    }
  }

  const clipboardAvailable = !!Clipboard;

  async function pasteFromClipboard() {
    if (!Clipboard) return;
    try {
      const text = await Clipboard.getStringAsync();
      const extracted = extractCodeFromClipboard(text);
      if (extracted) {
        setCode(extracted);
        toast.show('Код вставлено');
      } else {
        toast.show('У буфері обміну немає 6-значного коду');
      }
    } catch {
      toast.show('Не вдалося прочитати буфер обміну');
    }
  }

  codeRef.current = code;

  useEffect(() => {
    if (step !== 'code' || !Clipboard) return;
    let mounted = true;
    async function checkClipboard() {
      try {
        if (codeRef.current?.length === 6) return;
        const text = await Clipboard.getStringAsync();
        const extracted = extractCodeFromClipboard(text);
        if (mounted && extracted) {
          setCode(extracted);
          toast.show('Код вставлено з буфера');
        }
      } catch {}
    }
    checkClipboard();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkClipboard();
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, [step]);

  return (
    <View style={styles.container}>
      <AppText style={styles.title}>VanGo</AppText>
      {step === 'phone' ? (
        <>
          <AppText style={styles.label}>Номер телефону</AppText>
          <AppInput
            value={phone}
            onChangeText={(t) => setPhone(formatPhoneInput(t))}
            placeholder="+38 0XX XXX XX XX"
            keyboardType="phone-pad"
          />
          <AppButton
            title={loading ? 'Надсилання...' : 'Отримати код'}
            onPress={handleSendCode}
            disabled={loading}
          />
        </>
      ) : (
        <>
          <AppText style={styles.label}>Код з SMS</AppText>
          <AppInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
          {clipboardAvailable && (
            <TouchableOpacity style={styles.pasteLink} onPress={pasteFromClipboard}>
              <AppText style={styles.pasteLinkText}>Вставити код з буфера обміну</AppText>
            </TouchableOpacity>
          )}
          <AppButton
            title={loading ? 'Перевірка...' : 'Увійти'}
            onPress={handleVerify}
            disabled={loading}
          />
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => setStep('phone')}
            disabled={loading}
          >
            <AppText style={styles.backLinkText}>Змінити номер</AppText>
          </TouchableOpacity>
        </>
      )}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    color: colors.text,
  },
  pasteLink: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  pasteLinkText: {
    color: colors.primary,
    fontSize: 15,
  },
  backLink: {
    marginTop: 20,
    alignSelf: 'center',
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 16,
  },
});
