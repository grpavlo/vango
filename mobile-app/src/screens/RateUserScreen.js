import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';

export default function RateUserScreen({ route, navigation }) {
  const { token } = useAuth();
  const { toUserId, orderId, targetName, targetRole } = route.params || {};
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const title =
    targetRole === 'CUSTOMER'
      ? 'Оцініть замовника'
      : targetRole === 'DRIVER'
      ? 'Оцініть водія'
      : 'Оцініть користувача';

  function closeScreen() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  }

  async function submit() {
    if (!rating) {
      Alert.alert('Оцінка обовʼязкова', 'Оберіть від 1 до 5 зірок.');
      return;
    }
    try {
      setSubmitting(true);
      await apiFetch('/ratings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId, orderId, rating, comment })
      });
      Alert.alert('Дякуємо', 'Оцінку збережено.', [
        {
          text: 'OK',
          onPress: closeScreen,
        },
      ]);
    } catch (err) {
      Alert.alert('Помилка', err?.message || 'Не вдалося зберегти оцінку');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={closeScreen}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {targetName ? `${targetName}, замовлення №${orderId}` : `Замовлення №${orderId}`}
        </Text>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setRating(value)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={42}
                color={value <= rating ? '#F59E0B' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Коментар</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="За бажанням"
          placeholderTextColor={colors.gray600}
          multiline
          maxLength={1000}
        />

        <AppButton
          title={submitting ? 'Збереження...' : 'Надіслати оцінку'}
          onPress={submit}
          disabled={submitting || !rating}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.gray900,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.gray600,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 28,
  },
  label: {
    marginBottom: 8,
    color: colors.gray900,
    fontWeight: '700',
  },
  commentInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    backgroundColor: colors.surface,
    color: colors.gray900,
    textAlignVertical: 'top',
    fontSize: 16,
  },
});
