import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';
import { colors } from './Colors';

export default function ProfileCardSkeleton({ style }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton style={styles.avatar} />
      <Skeleton style={styles.line} />
      <Skeleton style={[styles.line, { width: '60%' }]} />
      <Skeleton style={styles.switch} />
      <Skeleton style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  line: { height: 20, borderRadius: 4, width: '80%', marginTop: 16 },
  switch: { height: 32, width: '100%', borderRadius: 20, marginTop: 24 },
  button: { height: 48, width: '100%', borderRadius: 12, marginTop: 16 },
});
