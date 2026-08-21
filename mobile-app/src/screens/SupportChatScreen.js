import React, { useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';
import { apiFetch } from '../api';

export default function SupportChatScreen({ route }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const publicMode = Boolean(route?.params?.publicMode);
  const scrollRef = useRef(null);
  const [questionText, setQuestionText] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      author: 'bot',
      text: publicMode
        ? 'Напишіть питання про вхід у VanGo, номер телефону або SMS-код, а я спробую швидко відповісти.'
        : 'Напишіть питання про роботу VanGo, а я спробую швидко відповісти.',
    },
  ]);
  const [sending, setSending] = useState(false);
  const hasConversation = messages.length > 1;

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    });
  }

  async function submitQuestion() {
    const text = questionText.trim();
    if (!text || sending) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        author: 'user',
        text,
      },
    ]);
    setQuestionText('');
    setSending(true);
    scrollToBottom();

    try {
      const headers = token && !publicMode ? { Authorization: `Bearer ${token}` } : {};
      const response = await apiFetch(publicMode ? '/support/public-ask' : '/support/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: text }),
      });
      setMessages((current) => [
        ...current,
        {
          id: `bot-${Date.now()}`,
          author: 'bot',
          text: response?.answer || 'Не вдалося знайти відповідь на це питання.',
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `bot-error-${Date.now()}`,
          author: 'bot',
          text:
            error?.message ||
            'Зараз не вдалося отримати відповідь. Перевірте інтернет і спробуйте ще раз.',
        },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: Math.max(insets.bottom, 0) + 22 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {!hasConversation && (
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.introTitle}>Робот підтримки</Text>
              <Text style={styles.introText}>
                {publicMode
                  ? 'Питайте про вхід, SMS-код, формат номера або проблеми з авторизацією.'
                  : 'Питайте про замовлення, ролі, сповіщення, оплату або налаштування.'}
              </Text>
            </View>
          )}

          <View style={styles.messages}>
            {messages.map((item) => {
              const isUser = item.author === 'user';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                    {item.text}
                  </Text>
                </View>
              );
            })}
            {sending && (
              <View style={[styles.messageBubble, styles.botBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Готую відповідь...</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.askBar, { paddingBottom: Math.max(insets.bottom + 10, 14) }]}>
          <TextInput
            value={questionText}
            onChangeText={setQuestionText}
            placeholder="Напишіть питання..."
            placeholderTextColor={colors.gray500}
            style={styles.input}
            multiline
            textAlignVertical="top"
            maxLength={800}
            editable={!sending}
            returnKeyType="send"
            onSubmitEditing={submitQuestion}
          />
          <TouchableOpacity
            activeOpacity={0.82}
            style={[
              styles.sendButton,
              (!questionText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={submitQuestion}
            disabled={!questionText.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
  messagesContent: {
    padding: 16,
  },
  intro: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  introIcon: {
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
  introTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  introText: {
    marginTop: 8,
    maxWidth: 330,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  messages: {
    gap: 9,
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  askBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray500,
    opacity: 0.45,
  },
});
