import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from './Skeleton';

export default function OrderCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={styles.map} />
      <View style={styles.textContainer}>
        <Skeleton style={styles.line} />
        <Skeleton style={[styles.line, { width: '60%' }]} />
        <Skeleton style={[styles.line, { width: '80%' }]} />
        <Skeleton style={[styles.line, { width: '40%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 8,
    borderRadius: 8,
    elevation: 2,
  },
  map: { height: 120, borderRadius: 8 },
  textContainer: { paddingVertical: 4 },
  line: { height: 16, marginTop: 8 },
});
