import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, AppState, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AppText from '../components/AppText';

let Clipboard = null;
try {
  Clipboard = require('expo-clipboard');
} catch {
  // Native module ExpoClipboard not available.
}

let OtpVerify = null;
try {
  const otpModule = require('react-native-otp-verify');
  OtpVerify = otpModule?.default || otpModule;
} catch {
  // Native module react-native-otp-verify not available until native rebuild.
}

import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { apiFetch } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../AuthContext';
import { formatUaPhoneInput, isCompleteUaPhone } from '../phoneMask';

function extractCodeFromText(text) {
  const match = text?.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

export default function PhoneAuthScreen({ navigation }) {
  const toast = useToast();
  const { login } = useAuth();
  const [phone, setPhone] = useState(formatUaPhoneInput(''));
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [loading, setLoading] = useState(false);
  const [androidSmsHash, setAndroidSmsHash] = useState(null);
  const codeRef = useRef('');

  useEffect(() => {
    if (Platform.OS !== 'android' || !OtpVerify?.getHash) return;
    let mounted = true;

    async function loadSmsHash() {
      try {
        const hashes = await OtpVerify.getHash();
        const hash = Array.isArray(hashes) ? hashes[0] : null;
        if (mounted && typeof hash === 'string' && hash.trim()) {
          setAndroidSmsHash(hash.trim());
        }
      } catch {
        // Fallback to default SMS format when hash is unavailable.
      }
    }

    loadSmsHash();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, '');
    let smsHash = androidSmsHash;

    if (!smsHash && Platform.OS === 'android' && OtpVerify?.getHash) {
      try {
        const hashes = await OtpVerify.getHash();
        const freshHash = Array.isArray(hashes) ? hashes[0] : null;
        if (typeof freshHash === 'string' && freshHash.trim()) {
          smsHash = freshHash.trim();
          setAndroidSmsHash(smsHash);
        }
      } catch {
        // Continue without hash if unavailable.
      }
    }

    if (!isCompleteUaPhone(phone)) {
      toast.show('Введіть коректний номер телефону');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({
          phone: digits,
          ...(smsHash ? { appHash: smsHash } : {}),
        }),
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
    const phoneStr = phone.replace(/\D/g, '');
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
      const extracted = extractCodeFromText(text);
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
    if (step !== 'code' || Platform.OS !== 'android' || !OtpVerify?.getOtp || !OtpVerify?.addListener) {
      return;
    }

    let mounted = true;

    async function startOtpListener() {
      try {
        await OtpVerify.getOtp();
        OtpVerify.addListener((message) => {
          if (!mounted || codeRef.current?.length === 6) return;
          const extracted = extractCodeFromText(message);
          if (extracted) {
            setCode(extracted);
            toast.show('Код автоматично зчитано з SMS');
          }
        });
      } catch {
        // OTP listener is optional; keep manual/clipboard fallback.
      }
    }

    startOtpListener();

    return () => {
      mounted = false;
      try {
        OtpVerify.removeListener();
      } catch {}
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'code' || !Clipboard) return;
    let mounted = true;
    async function checkClipboard() {
      try {
        if (codeRef.current?.length === 6) return;
        const text = await Clipboard.getStringAsync();
        const extracted = extractCodeFromText(text);
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
     <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={80}
      enableOnAndroid={true}
      showsVerticalScrollIndicator={false}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          <AppText style={styles.title}>VanGo</AppText>
          {step === 'phone' ? (
            <>
              <AppText style={styles.label}>Номер телефону</AppText>
              <AppInput
                value={phone}
                onChangeText={(t) => setPhone(formatUaPhoneInput(t))}
                placeholder="+380XXXXXXXXX"
                keyboardType="phone-pad"
                maxLength={13}
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
                autoComplete={Platform.select({ ios: 'one-time-code', default: 'sms-otp' })}
                importantForAutofill="yes"
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
      </TouchableWithoutFeedback>
    </KeyboardAwareScrollView>
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
