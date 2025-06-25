import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './Colors';

export default function StatusTimeline({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <View style={styles.card}>
      {history.map((h, i) => {
        const isFirst = i === 0;
        const isLast = i === history.length - 1;
        const dotColor = isFirst ? colors.orange : isLast ? colors.green : '#ccc';
        const lineColor = isLast ? colors.green : '#ccc';
        return (
          <View key={i} style={styles.row}>
            <View style={styles.timeline}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
            </View>
            <View style={styles.content}>
              <Text style={styles.time}>{new Date(h.at).toLocaleString()}</Text>
              <Text style={styles.label}>{h.label || h.status}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  timeline: { width: 16, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, width: 2, marginTop: 2 },
  content: { flex: 1 },
  label: { fontWeight: 'bold' },
  time: { color: '#555', fontSize: 12 },
});
