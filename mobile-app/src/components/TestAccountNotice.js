import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';

export default function TestAccountNotice({ children }) {
  const { token, isTestAccount } = useAuth();
  const insets = useSafeAreaInsets();
  if (!token || !isTestAccount) return children;
  return (
    <View style={styles.container}>
      <View accessibilityRole="text" style={[styles.notice, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Тестовий акаунт</Text>
        <Text style={styles.text}>Демонстраційний профіль. Не вводьте особисті документи.</Text>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.container}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: { backgroundColor: '#FFF0C2', paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: '#493300', fontSize: 14, fontWeight: '700' },
  text: { color: '#493300', fontSize: 12, marginTop: 2 },
});
