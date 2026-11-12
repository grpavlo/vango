import React, { useLayoutEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import AppText from '../components/AppText';
import AppButton from '../components/AppButton';
import { colors } from '../components/Colors';
import { useAuth } from '../AuthContext';
import { isDeletionLocked } from '../accountDeletionFlow';

const STATUS_LABELS = {CREATED: 'Створено', PENDING: 'Очікує підтвердження', ACCEPTED: 'Прийнято', IN_PROGRESS: 'У роботі', DELIVERED: 'Доставлено, очікує завершення'};

export default function DeleteAccountScreen({ navigation }) {
  const { accountDeletion, beginAccountDeletion, retryAccountDeletion,
    exitUnconfirmedDeletion, dismissBlockedDeletion, role, needsProfileSetup } = useAuth();
  const [localError, setLocalError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const locked = isDeletionLocked(accountDeletion);
  const phase = accountDeletion?.phase;
  const busy = localBusy || phase === 'requesting' || (phase === 'local_cleanup' && !accountDeletion?.message);
  useLayoutEffect(() => {
    navigation.setOptions({gestureEnabled: !locked, headerBackVisible: !locked});
  }, [navigation, locked]);

  async function perform(action) {
    setLocalError('');
    setLocalBusy(true);
    try { await action(); }
    catch { setLocalError('Не вдалося завершити дію. Спробуйте ще раз.'); }
    finally { setLocalBusy(false); }
  }
  function cancel() {
    dismissBlockedDeletion();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace(!role ? 'Role' : needsProfileSetup ? 'RoleProfile' : 'Main');
  }
  function openOrder(id) {
    dismissBlockedDeletion();
    navigation.navigate('OrderDetail', {orderId: id});
  }
  return (
    <Screen hasFooter>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}><Ionicons name="trash-outline" size={34} color={colors.red} /></View>
        <AppText style={styles.title}>Видалити акаунт</AppText>
        {!locked && <>
          <AppText style={styles.paragraph}>Цю дію неможливо скасувати. Ваш профіль, документи, фотографії, обране, збережені пошуки, сповіщення та звернення в підтримку буде видалено.</AppText>
          <AppText style={styles.paragraph}>В історії замовлень, оцінках і фінансових записах замість особистих даних буде «Акаунт видалено». Суми збережуться. Видалення не означає погашення боргів або завершення розрахунків поза VanGo.</AppText>
          <AppText style={styles.paragraph}>Якщо є активні замовлення, спочатку завершіть або скасуйте їх. Після підтвердження сервера застосунок очистить особисті дані на цьому пристрої та поверне вас до входу.</AppText>
          <AppText style={styles.note}>Цей процес охоплює дані застосунку. Він не підтверджує очищення копій у сторонніх сервісах і резервних копіях.</AppText>
        </>}
        {(accountDeletion?.message || localError) ? <AppText accessibilityLiveRegion="polite" style={styles.message}>{localError || accountDeletion.message}</AppText> : null}
        {busy && <View accessibilityLabel="Видалення триває" style={styles.progress}>
          <ActivityIndicator color={colors.red} />
          <AppText style={styles.paragraph}>{phase === 'local_cleanup' ? 'Очищуємо дані на пристрої…' : 'Надсилаємо запит на видалення…'}</AppText>
        </View>}
        {phase === 'blocked' && accountDeletion.orders?.map(order => (
          <AppButton key={order.id} title={`Замовлення №${order.id}: ${STATUS_LABELS[order.status] || 'Активне'}`}
            onPress={() => openOrder(order.id)} color={colors.gray500} />
        ))}
        {!locked && <>
          <AppButton title="Видалити назавжди" variant="danger" onPress={() => perform(beginAccountDeletion)} accessibilityLabel="Підтвердити незворотне видалення акаунта" />
          <AppButton title="Скасувати" color={colors.gray500} onPress={cancel} />
        </>}
        {locked && !busy && phase !== 'auth_required' && <AppButton
          title={phase === 'pending' ? 'Перевірити завершення' : phase === 'local_cleanup' ? 'Повторити очищення' : 'Повторити запит'}
          onPress={() => perform(retryAccountDeletion)} />}
        {locked && !busy && <>
          <AppText style={styles.note}>Можна вийти до екрана входу. Це не скасовує вже надісланий запит і не підтверджує видалення акаунта.</AppText>
          <AppButton title="До входу" color={colors.gray500} onPress={() => perform(exitUnconfirmedDeletion)} />
        </>}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: {padding: 24, paddingBottom: 40, gap: 12},
  icon: {alignItems: 'center', paddingVertical: 12},
  title: {fontSize: 25, fontWeight: '800', textAlign: 'center', marginBottom: 8},
  paragraph: {lineHeight: 23},
  note: {fontSize: 14, lineHeight: 20, color: colors.gray500},
  message: {lineHeight: 23, padding: 14, borderRadius: 12, backgroundColor: '#FEF3C7'},
  progress: {gap: 16, alignItems: 'center', paddingVertical: 24},
});
