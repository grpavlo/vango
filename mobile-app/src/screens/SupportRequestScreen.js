import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../api';

const statusLabels = {
  OPEN: 'Передано',
  ANSWERED: 'Є відповідь',
};

function normalizeStatus(status) {
  return status === 'CLOSED' ? 'ANSWERED' : status;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportRequestScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadQuestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('/support/questions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadQuestions();
    }, [loadQuestions])
  );

  async function submitQuestion() {
    const text = question.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const response = await apiFetch('/support/questions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: text }),
      });
      setQuestion('');
      setSuccessMessage(
        response?.message ||
          'Питання передано розробникам. Ви отримаєте відповідь у застосунку найближчим часом.'
      );
      await loadQuestions();
    } catch (error) {
      setErrorMessage(error?.message || 'Не вдалося передати питання. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 0) + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="construct-outline" size={30} color={colors.primary} />
            </View>
            <Text style={styles.title}>Питання розробникам</Text>
            <Text style={styles.subtitle}>
              Опишіть, що незрозуміло або що не працює. Ми зафіксуємо питання й
              передамо його команді.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Ваше питання</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Наприклад: не приходить SMS, не бачу сповіщення..."
              placeholderTextColor={colors.gray500}
              style={styles.textarea}
              multiline
              textAlignVertical="top"
              maxLength={1200}
              editable={!submitting}
            />
            <Text style={styles.counter}>{question.length}/1200</Text>

            {!!successMessage && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {!!errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.red} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.84}
              style={[
                styles.submitButton,
                (!question.trim() || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={submitQuestion}
              disabled={!question.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.submitText}>Передати розробникам</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Мої звернення</Text>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {items.length === 0 && !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Звернень ще немає</Text>
              <Text style={styles.emptyText}>
                Після відправки питання воно зʼявиться тут разом зі статусом.
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {items.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        normalizeStatus(item.status) === 'ANSWERED' && styles.statusBadgeAnswered,
                      ]}
                    >
                      {statusLabels[normalizeStatus(item.status)] || normalizeStatus(item.status)}
                    </Text>
                  </View>
                  <Text style={styles.questionText}>{item.question}</Text>
                  {!!item.answer && (
                    <View style={styles.answerBox}>
                      <Text style={styles.answerLabel}>Відповідь</Text>
                      <Text style={styles.answerText}>{item.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary100,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    maxWidth: 340,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  formCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  textarea: {
    minHeight: 130,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    color: colors.gray500,
    fontSize: 12,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.primary100,
    marginTop: 10,
  },
  successText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  submitButton: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray500,
    opacity: 0.45,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  historyHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  historyDate: {
    color: colors.gray500,
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeAnswered: {
    color: colors.primary,
    backgroundColor: colors.primary100,
  },
  questionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  answerBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  answerLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  answerText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
