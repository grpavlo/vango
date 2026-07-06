import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';

export default function RatingDetailScreen({ route, navigation }) {
  const params = route?.params || {};
  const rating = Number(params.rating);
  const safeRating = Number.isFinite(rating) && rating > 0 ? rating : 5;
  const orderNumber = params.orderNumber || params.orderId;
  const fromRoleLabel = params.fromRoleLabel || 'Користувач';
  const fromUserName = params.fromUserName || fromRoleLabel;
  const comment = typeof params.comment === 'string' ? params.comment.trim() : '';

  function goToOrder() {
    if (!params.orderId) return;
    navigation.navigate('OrderDetail', { orderId: params.orderId });
  }

  return (
    <Screen>
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="star" size={36} color="#F59E0B" />
          </View>

          <Text style={styles.title}>Оцінка за замовлення №{orderNumber}</Text>
          <Text style={styles.subtitle}>
            {fromRoleLabel} {fromUserName} залишив оцінку
          </Text>

          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Ionicons
                key={value}
                name={value <= Math.round(safeRating) ? 'star' : 'star-outline'}
                size={30}
                color={value <= Math.round(safeRating) ? '#F59E0B' : '#D1D5DB'}
              />
            ))}
            <Text style={styles.ratingText}>{safeRating.toFixed(1)}</Text>
          </View>

          <View style={styles.commentBox}>
            <Text style={styles.commentLabel}>Коментар</Text>
            <Text style={styles.commentText}>{comment || 'Коментар не залишили.'}</Text>
          </View>

          {params.orderId ? (
            <AppButton title="Відкрити замовлення" onPress={goToOrder} style={styles.orderButton} />
          ) : null}
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  title: {
    color: colors.gray900,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  ratingText: {
    marginLeft: 8,
    color: colors.gray900,
    fontSize: 20,
    fontWeight: '800',
  },
  commentBox: {
    width: '100%',
    marginTop: 24,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  commentLabel: {
    color: colors.gray700,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  commentText: {
    color: colors.gray900,
    fontSize: 16,
    lineHeight: 22,
  },
  orderButton: {
    marginTop: 20,
  },
});
