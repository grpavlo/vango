import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../components/Colors';
import {
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '../notificationCenter';

function formatNotificationTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNavigationTarget(item) {
  const data = item?.data || {};
  const orderId = data.orderId;
  const target = data.navigateTo;

  if (target === 'driverOrders') {
    return { route: 'Main', params: { screen: 'All' } };
  }

  if (target === 'driverHistory') {
    return {
      route: 'Main',
      params: {
        screen: 'MyOrders',
        params: {
          presetFilter: 'history',
          presetFilterRequestId: item.id,
        },
      },
    };
  }

  if (orderId) {
    return {
      route: 'OrderDetail',
      params: {
        orderId,
        notificationReminderStep: data.reminderStep,
        notificationOpenedAt: item.id,
      },
    };
  }

  return null;
}

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeNotifications(setItems), []);

  const unreadCount = useMemo(() => getUnreadNotificationCount(items), [items]);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
  }

  async function handlePressNotification(item) {
    await markNotificationRead(item.id);
    const target = getNavigationTarget(item);
    if (target) {
      navigation.navigate(target.route, target.params);
    }
  }

  function renderNotification({ item }) {
    const target = getNavigationTarget(item);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        style={[styles.card, !item.read && styles.unreadCard]}
        onPress={() => handlePressNotification(item)}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={item.read ? 'notifications-outline' : 'notifications'}
            size={22}
            color={colors.primary}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.read && styles.unreadTitle]} numberOfLines={2}>
              {item.title || 'Сповіщення'}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>

          {!!item.body && (
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
          )}

          {!!item.receivedAt && (
            <Text style={styles.time}>{formatNotificationTime(item.receivedAt)}</Text>
          )}
        </View>

        {target && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
            style={styles.chevron}
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {items.length > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.counter}>
            {unreadCount > 0 ? `Непрочитані: ${unreadCount}` : 'Усі сповіщення прочитані'}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.readAllButton} onPress={handleMarkAllRead}>
              <Text style={styles.readAllText}>Прочитати всі</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.emptyContent,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Сповіщень поки немає</Text>
            <Text style={styles.emptyText}>
              Тут з'являтимуться повідомлення про ваші замовлення.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  counter: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  readAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary100,
  },
  readAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 10,
  },
  card: {
    minHeight: 92,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  unreadTitle: {
    color: colors.gray900,
  },
  body: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  time: {
    marginTop: 8,
    color: colors.gray500,
    fontSize: 12,
    fontWeight: '600',
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: '#DC2626',
  },
  chevron: {
    marginLeft: 8,
    marginTop: 9,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
