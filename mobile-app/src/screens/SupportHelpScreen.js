import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';

const QUICK_QUESTIONS = [
  {
    id: 'what-is-vango',
    question: 'Що таке VanGo?',
    answer:
      'VanGo - це застосунок для швидкого пошуку вантажних перевезень. Клієнти можуть створювати замовлення, а водії - знаходити відповідні заявки, домовлятися про умови та виконувати перевезення.',
  },
  {
    id: 'phone-format',
    question: 'У якому форматі вводити номер телефону?',
    answer:
      'Вводьте український номер без зайвих символів. Найкраще використовувати формат +380XXXXXXXXX або 0XXXXXXXXX. Якщо код не надходить, спершу перевірте, чи немає помилки в цифрах.',
  },
  {
    id: 'sms-not-received',
    question: 'Не прийшло SMS з кодом. Що робити?',
    answer:
      'Перевірте введений номер, зачекайте до хвилини та спробуйте надіслати код ще раз. Також перевірте інтернет, сигнал мобільної мережі та чи не потрапило SMS у спам або заблоковані повідомлення.',
  },
  {
    id: 'no-notifications',
    question: 'Чому немає сповіщень?',
    answer:
      'Перевірте, чи дозволені сповіщення для VanGo в налаштуваннях телефону. Також переконайтесь, що є інтернет та чи ви увійшли в акаунт. Історію можна переглянути через дзвіночок у верхній частині екрана.',
  },
  {
    id: 'create-order',
    question: 'Як створити замовлення?',
    answer:
      'Перейдіть у роль "Замовник" і відкрийте вкладку "Створити". Заповніть точки завантаження та розвантаження, дату, параметри вантажу, оплату й опис. Якщо додаєте фото, дочекайтесь завершення завантаження, після чого натисніть кнопку створення замовлення.',
  },
  {
    id: 'cannot-create-order',
    question: 'Не вдається створити замовлення',
    answer:
      'Перевірте, чи заповнені обовʼязкові поля: адреси, дата, параметри вантажу, оплата та опис. Якщо є фото, дочекайтесь завершення завантаження. Після цього перевірте інтернет і спробуйте ще раз.',
  },
  {
    id: 'search-orders',
    question: 'Як шукати замовлення?',
    answer:
      'Перейдіть у роль "Водій" і відкрийте вкладку "Мапа". Там показуються доступні замовлення поруч із вами або в обраному районі. За потреби змініть фільтри пошуку, відкрийте потрібне замовлення та натисніть "Відгукнутися", щоб запропонувати свої умови.',
  },
  {
    id: 'orders-not-visible',
    question: 'Чому я не бачу замовлення?',
    answer:
      'Перевірте вашу роль, фільтри, мапу або список доступних замовлень. Для водія заявки можуть не показуватись, якщо немає активних замовлень у вибраному районі або фільтр звужує пошук.',
  },
  {
    id: 'change-role',
    question: 'Як змінити роль у застосунку?',
    answer:
      'Відкрийте налаштування та скористайтесь перемикачем ролі. Клієнт створює замовлення, водій шукає та виконує перевезення.',
  },
  {
    id: 'app-error',
    question: 'Що робити, якщо застосунок показує помилку?',
    answer:
      'Оновіть екран, перевірте інтернет і повторіть дію. Якщо помилка не зникає, перезапустіть застосунок. Для входу, SMS та сповіщень також варто перевірити дозволи застосунку в налаштуваннях телефону.',
  },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SupportHelpScreen({ navigation }) {
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  function toggleQuestion(id) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedQuestionId((currentId) => (currentId === id ? null : id));
  }

  function openChat() {
    navigation.navigate('SupportChat');
  }

  function openRequest() {
    navigation.navigate('SupportRequest');
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="headset-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Швидкі питання</Text>
          <Text style={styles.subtitle}>
            Тут зібрані відповіді про роботу VanGo. Якщо потрібна інша відповідь,
            відкрийте окремий чат із роботом.
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.84} style={styles.chatButton} onPress={openChat}>
          <View style={styles.chatButtonIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.chatButtonTextWrap}>
            <Text style={styles.chatButtonTitle}>Запитати робота</Text>
            <Text style={styles.chatButtonText}>Окреме вікно для ваших питань</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.84} style={styles.chatButton} onPress={openRequest}>
          <View style={styles.chatButtonIcon}>
            <Ionicons name="construct-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.chatButtonTextWrap}>
            <Text style={styles.chatButtonTitle}>Передати у техпідтримку</Text>
            <Text style={styles.chatButtonText}>Зафіксувати питання про роботу застосунку</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.questions}>
          <Text style={styles.sectionTitle}>Готові відповіді</Text>
          {QUICK_QUESTIONS.map((item) => {
            const expanded = expandedQuestionId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.82}
                style={styles.questionCard}
                onPress={() => toggleQuestion(item.id)}
              >
                <View style={styles.questionRow}>
                  <Text style={styles.questionText}>{item.question}</Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                {expanded && <Text style={styles.answerText}>{item.answer}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
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
  chatButton: {
    minHeight: 74,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  chatButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary100,
    marginRight: 12,
  },
  chatButtonTextWrap: {
    flex: 1,
  },
  chatButtonTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  chatButtonText: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  questions: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  questionCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  questionText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  answerText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
