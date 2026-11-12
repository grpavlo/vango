import React from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isDeletedAccount } from '../accountIdentity';
import { colors } from './Colors';

export default function AccountAvatar({ account, photoUri, size = 36 }) {
  if (isDeletedAccount(account)) return <Ionicons name="ban-outline" size={size} color={colors.gray500} accessibilityLabel="Акаунт видалено" />;
  if (photoUri) return <Image source={{uri: photoUri}} style={{width: size, height: size, borderRadius: size / 2}} />;
  return <Ionicons name="person-circle" size={size} color={colors.green} />;
}
