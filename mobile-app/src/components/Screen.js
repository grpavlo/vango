// src/components/Screen.js
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * hasFooter: true — на екрані є нижні кнопки/панель.
 * noFooterPadding: мінімальний відступ знизу, коли футера немає (за замовч. 8).
 * extraFooterPadding: додатковий зазор під футером (за замовч. 8).
 */
export default function Screen({
  children,
  style,
  hasFooter = false,
  noFooterPadding = 12,
  extraFooterPadding = 8,
}) {
  const insets = useSafeAreaInsets();

  // 1) Якщо футера НЕМає — взагалі не застосовуємо bottom-safe-area.
  //    Дамо лише малий фіксований відступ.
  const edges = hasFooter ? ['bottom', 'left', 'right'] : ['left', 'right'];
  const bottomPadding = hasFooter
    ? 0     // футер “сидить” вище жестової панелі
    : noFooterPadding;                          // маленький статичний відступ

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={edges}>
      <View style={{ flex: 1, paddingBottom: bottomPadding, ...(style || {}) }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
