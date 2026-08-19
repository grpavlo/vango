import React from 'react';
import { StyleSheet, View } from 'react-native';
import NotificationBell from './NotificationBell';
import SupportButton from './SupportButton';

export default function HeaderActions() {
  return (
    <View style={styles.container}>
      <SupportButton />
      <NotificationBell />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -4,
  },
});
