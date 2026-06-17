import React, { useEffect, useRef, useCallback, useState } from 'react';
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
import { navigationRef } from './src/navigationRef';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addStoredNotification } from './src/notificationCenter';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,   // ← вмикаємо звук
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

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
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      storeNotification(response?.notification, true);
      const notificationId = response?.notification?.request?.identifier;
      const data = response?.notification?.request?.content?.data;
      handleNotificationNavigation(data, notificationId);
    });
    (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        storeNotification(lastResponse?.notification, true);
        const notificationId = lastResponse?.notification?.request?.identifier;
        const data = lastResponse?.notification?.request?.content?.data;
        handleNotificationNavigation(data, notificationId);
      }
    })();
    return () => {
      receivedSub.remove();
      sub.remove();
    };
  }, [handleNotificationNavigation]);

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
