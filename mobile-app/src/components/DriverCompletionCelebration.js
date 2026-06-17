import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './Colors';

const FIREWORKS = [
  { x: -168, y: -156, color: '#F59E0B', size: 16 },
  { x: -124, y: -218, color: '#22C55E', size: 13 },
  { x: -58, y: -188, color: '#38BDF8', size: 15 },
  { x: 18, y: -226, color: '#F97316', size: 13 },
  { x: 92, y: -190, color: '#84CC16', size: 16 },
  { x: 162, y: -134, color: '#F43F5E', size: 14 },
  { x: 188, y: -54, color: '#FBBF24', size: 15 },
  { x: 150, y: 34, color: '#2DD4BF', size: 13 },
  { x: 78, y: 100, color: '#A855F7', size: 14 },
  { x: -12, y: 118, color: '#10B981', size: 13 },
  { x: -96, y: 82, color: '#FB7185', size: 15 },
  { x: -188, y: 18, color: '#60A5FA', size: 13 },
  { x: -214, y: -76, color: '#FDE047', size: 12 },
  { x: -136, y: -34, color: '#EC4899', size: 11 },
  { x: -44, y: -78, color: '#34D399', size: 12 },
  { x: 50, y: -92, color: '#FACC15', size: 11 },
  { x: 132, y: -28, color: '#818CF8', size: 12 },
  { x: 54, y: 42, color: '#FB923C', size: 11 },
];

export function getOrderCompletionEarnings(order) {
  const finalPrice = Number(order?.finalPrice);
  const price = Number(order?.price);
  const value =
    Number.isFinite(finalPrice) && finalPrice > 0
      ? finalPrice
      : Number.isFinite(price) && price > 0
      ? price
      : null;
  return value === null ? null : Math.round(value);
}

function formatEarnings(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '— грн';
  return `${Math.round(Number(value)).toLocaleString('uk-UA')} грн`;
}

export default function DriverCompletionCelebration({ visible, earnings, onClose }) {
  const cardScale = useRef(new Animated.Value(0.86)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const burstProgress = useRef(new Animated.Value(0)).current;

  const formattedEarnings = useMemo(() => formatEarnings(earnings), [earnings]);

  useEffect(() => {
    if (!visible) return undefined;

    cardScale.setValue(0.86);
    cardOpacity.setValue(0);
    burstProgress.setValue(0);

    const burstLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(burstProgress, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(burstProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(80),
      ])
    );

    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    burstLoop.start();

    return () => {
      burstLoop.stop();
    };
  }, [burstProgress, cardOpacity, cardScale, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.burstLayer} pointerEvents="none">
          {FIREWORKS.map((dot, index) => {
            const translateX = burstProgress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, dot.x, dot.x * 1.14],
            });
            const translateY = burstProgress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [0, dot.y, dot.y * 1.14],
            });
            const opacity = burstProgress.interpolate({
              inputRange: [0, 0.12, 0.82, 1],
              outputRange: [0, 1, 1, 0],
            });
            const scale = burstProgress.interpolate({
              inputRange: [0, 0.56, 1],
              outputRange: [0.7, 1.85, 0.35],
            });
            return (
              <Animated.View
                key={`${dot.color}-${index}`}
                style={[
                  styles.fireworkDot,
                  {
                    width: dot.size,
                    height: dot.size,
                    borderRadius: dot.size / 2,
                    backgroundColor: dot.color,
                    opacity,
                    transform: [{ translateX }, { translateY }, { scale }],
                  },
                ]}
              />
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={52} color="#fff" />
          </View>
          <Text style={styles.title}>Замовлення виконане</Text>
          <Text style={styles.subtitle}>Ваш заробіток</Text>
          <Text style={styles.earnings}>{formattedEarnings}</Text>
          <Text style={styles.message}>Ви молодець! Так тримати!</Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Супер</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    padding: 24,
  },
  burstLayer: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fireworkDot: {
    position: 'absolute',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 8,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
    zIndex: 1,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green,
    borderWidth: 5,
    borderColor: '#DCFCE7',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  earnings: {
    marginTop: 4,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#16A34A',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: '#273033',
    textAlign: 'center',
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orange,
    marginTop: 22,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
