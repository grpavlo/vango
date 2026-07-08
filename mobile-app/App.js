import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Host } from 'react-native-portalize';
import { ToastProvider } from './src/components/Toast';
import StartupAnimation from './src/components/StartupAnimation';
import { AuthProvider, useAuth } from './src/AuthContext';
import PhoneAuthScreen from './src/screens/PhoneAuthScreen';
import RoleScreen from './src/screens/RoleScreen';
import RoleProfileWrapper from './src/screens/RoleProfileWrapper';
import MainTabs from './src/screens/MainTabs';
import MapSelectScreen from './src/screens/MapSelectScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import EditOrderScreen from './src/screens/EditOrderScreen';
import EditProfile from './src/screens/EditProfile';
import EditCustomerProfileScreen from './src/screens/EditCustomerProfileScreen';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RateUserScreen from './src/screens/RateUserScreen';
import RatingDetailScreen from './src/screens/RatingDetailScreen';
import { navigationRef } from './src/navigationRef';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addStoredNotification } from './src/notificationCenter';
import { emitOrderChange } from './src/orderChangeEvents';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,   // ← вмикаємо звук
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const DEFAULT_NOTIFICATION_TITLE = 'Сповіщення';

function RootNavigator({ introComplete, onIntroComplete }) {
  const { token, role, needsProfileSetup, loading } = useAuth();

  if (!introComplete || loading) {
    return (
      <StartupAnimation
        play={!introComplete}
        showSpinner={introComplete && loading}
        onFinish={onIntroComplete}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token == null ? (
        <Stack.Screen name="Login" component={PhoneAuthScreen} />
      ) : role == null ? (
        <Stack.Screen name="Role" component={RoleScreen} />
      ) : needsProfileSetup ? (
        <Stack.Screen name="RoleProfile" component={RoleProfileWrapper} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="MapSelect" component={MapSelectScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="EditOrder" component={EditOrderScreen} />
          <Stack.Screen name="ProfileScreen" component={EditProfile} />
          <Stack.Screen name="CustomerProfileScreen" component={EditCustomerProfileScreen} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
          <Stack.Screen name="Analytics" component={AnalyticsScreen} />
          <Stack.Screen name="RateUser" component={RateUserScreen} />
          <Stack.Screen name="RatingDetail" component={RatingDetailScreen} />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerShown: true,
              title: 'Сповіщення',
              headerTitleAlign: 'center',
              headerStyle: { backgroundColor: '#f9fafb' },
              headerTitleStyle: {
                color: '#273033',
                fontSize: 20,
                fontWeight: '800',
              },
              headerTintColor: '#273033',
              headerShadowVisible: true,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
export default function App() {
  const pendingNavigationActionRef = useRef(null);
  const handledNotificationIdsRef = useRef(new Set());
  const shownInAppNotificationIdsRef = useRef(new Set());
  const [introComplete, setIntroComplete] = useState(false);

  const executeNavigationAction = useCallback((action) => {
    if (!action) {
      return;
    }
    switch (action.type) {
      case 'orderDetail':
        if (action.orderId) {
          navigationRef.navigate('OrderDetail', {
            orderId: action.orderId,
            notificationReminderStep: action.reminderStep,
            notificationOpenedAt: action.requestId,
          });
        }
        break;
      case 'driverOrders':
        navigationRef.navigate('Main', { screen: 'All' });
        break;
      case 'driverHistory':
        navigationRef.navigate('Main', {
          screen: 'MyOrders',
          params: {
            presetFilter: 'history',
            presetFilterRequestId: action.requestId,
          },
        });
        break;
      case 'rateOrder':
        navigationRef.navigate('RateUser', {
          orderId: action.orderId,
          toUserId: action.toUserId,
          targetName: action.targetName,
          targetRole: action.targetRole,
        });
        break;
      case 'ratingDetail':
        navigationRef.navigate('RatingDetail', {
          ratingId: action.ratingId,
          orderId: action.orderId,
          orderNumber: action.orderNumber,
          rating: action.rating,
          comment: action.comment,
          fromUserName: action.fromUserName,
          fromRoleLabel: action.fromRoleLabel,
        });
        break;
      default:
        break;
    }
  }, []);

  const queueNavigationAction = useCallback(
    (action) => {
      if (!action) {
        return;
      }
      if (navigationRef.isReady()) {
        executeNavigationAction(action);
      } else {
        pendingNavigationActionRef.current = action;
      }
    },
    [executeNavigationAction]
  );

  const buildNavigationAction = useCallback((data = {}) => {
    const target = data?.navigateTo;
    const orderId = data?.orderId;
    const reminderStep = data?.reminderStep;
    const requestId = Date.now();
    switch (target) {
      case 'driverOrders':
        return { type: 'driverOrders', orderId, requestId };
      case 'driverHistory':
        return { type: 'driverHistory', orderId, requestId };
      case 'orderDetail':
        if (orderId) {
          return { type: 'orderDetail', orderId, reminderStep, requestId };
        }
        return null;
      case 'rateOrder':
        if (orderId && data?.toUserId) {
          return {
            type: 'rateOrder',
            orderId,
            toUserId: data.toUserId,
            targetName: data.targetName,
            targetRole: data.targetRole,
            requestId,
          };
        }
        return null;
      case 'ratingDetail':
        return {
          type: 'ratingDetail',
          ratingId: data.ratingId,
          orderId,
          orderNumber: data.orderNumber,
          rating: data.rating,
          comment: data.comment,
          fromUserName: data.fromUserName,
          fromRoleLabel: data.fromRoleLabel,
          requestId,
        };
      default:
        if (orderId) {
          return { type: 'orderDetail', orderId, reminderStep, requestId };
        }
        return null;
    }
  }, []);

  const handleNotificationNavigation = useCallback(
    (data, notificationId) => {
      const action = buildNavigationAction(data);
      if (!action) {
        return;
      }
      const dedupeKey =
        notificationId ?? `${action.type}-${action.orderId ?? action.requestId}`;
      if (handledNotificationIdsRef.current.has(dedupeKey)) {
        return;
      }
      handledNotificationIdsRef.current.add(dedupeKey);
      queueNavigationAction(action);
    },
    [buildNavigationAction, queueNavigationAction]
  );

  const notifyOrderChangeFromPush = useCallback((data = {}) => {
    if (!data?.orderId) return;
    emitOrderChange({
      orderId: data.orderId,
      data,
      source: 'push',
      receivedAt: Date.now(),
    });
  }, []);

  const showInAppNotification = useCallback(
    (notification) => {
      const request = notification?.request;
      const content = request?.content;
      if (!request || !content) return;

      const data = content.data || {};
      const title = String(content.title || '').trim();
      const body = String(content.body || '').trim();
      const hasAction = Boolean(buildNavigationAction(data));
      const hasVisibleText = Boolean(title || body);
      if (!hasVisibleText) return;
      if (title === DEFAULT_NOTIFICATION_TITLE && !body) return;

      const dedupeKey =
        request.identifier || `${Date.now()}-${data?.orderId || 'notification'}`;
      if (shownInAppNotificationIdsRef.current.has(dedupeKey)) return;
      shownInAppNotificationIdsRef.current.add(dedupeKey);

      const buttons = hasAction
        ? [
            { text: 'Закрити', style: 'cancel' },
            {
              text: 'Відкрити',
              onPress: () => handleNotificationNavigation(data, request.identifier),
            },
          ]
        : [{ text: 'OK' }];

      Alert.alert(title || 'Сповіщення', body || '', buttons);
    },
    [buildNavigationAction, handleNotificationNavigation]
  );

  const handleNavigationReady = useCallback(() => {
    if (pendingNavigationActionRef.current) {
      executeNavigationAction(pendingNavigationActionRef.current);
      pendingNavigationActionRef.current = null;
    }
  }, [executeNavigationAction]);

  useEffect(() => {
    const storeNotification = (notification, read = false) => {
      const request = notification?.request;
      const content = request?.content;
      if (!request || !content) return;
      addStoredNotification({
        id: request.identifier,
        content,
        read,
      }).catch(() => {});
    };

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      storeNotification(notification, false);
      const data = notification?.request?.content?.data || {};
      notifyOrderChangeFromPush(data);
      showInAppNotification(notification);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      storeNotification(response?.notification, true);
      const notificationId = response?.notification?.request?.identifier;
      const data = response?.notification?.request?.content?.data;
      notifyOrderChangeFromPush(data || {});
      handleNotificationNavigation(data, notificationId);
    });
    (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        storeNotification(lastResponse?.notification, true);
        const notificationId = lastResponse?.notification?.request?.identifier;
        const data = lastResponse?.notification?.request?.content?.data;
        notifyOrderChangeFromPush(data || {});
        handleNotificationNavigation(data, notificationId);
      }
    })();
    return () => {
      receivedSub.remove();
      sub.remove();
    };
  }, [handleNotificationNavigation, notifyOrderChangeFromPush, showInAppNotification]);

  return (
    <Host>
      <ToastProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
            <RootNavigator
              introComplete={introComplete}
              onIntroComplete={() => setIntroComplete(true)}
            />
          </NavigationContainer>
        </AuthProvider>
      </ToastProvider>
    </Host>
  );
}
