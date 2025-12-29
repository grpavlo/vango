import React, { useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Host } from 'react-native-portalize';
import { ToastProvider } from './src/components/Toast';
import { AuthProvider, useAuth } from './src/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoleScreen from './src/screens/RoleScreen';
import MainTabs from './src/screens/MainTabs';
import MapSelectScreen from './src/screens/MapSelectScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import EditOrderScreen from './src/screens/EditOrderScreen';
import EditProfile from './src/screens/EditProfile';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import { navigationRef } from './src/navigationRef';
import { SafeAreaProvider } from 'react-native-safe-area-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true }),
});

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { token, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token == null ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : role == null ? (
        <Stack.Screen name="Role" component={RoleScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="MapSelect" component={MapSelectScreen} />
          <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          <Stack.Screen name="EditOrder" component={EditOrderScreen} />
          <Stack.Screen name="ProfileScreen" component={EditProfile} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
export default function App() {
  const pendingNavigationActionRef = useRef(null);
  const handledNotificationIdsRef = useRef(new Set());

  const executeNavigationAction = useCallback((action) => {
    if (!action) {
      return;
    }
    switch (action.type) {
      case 'orderDetail':
        if (action.orderId) {
          navigationRef.navigate('OrderDetail', { orderId: action.orderId });
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
    const requestId = Date.now();
    switch (target) {
      case 'driverOrders':
        return { type: 'driverOrders', orderId, requestId };
      case 'driverHistory':
        return { type: 'driverHistory', orderId, requestId };
      case 'orderDetail':
        if (orderId) {
          return { type: 'orderDetail', orderId, requestId };
        }
        return null;
      default:
        if (orderId) {
          return { type: 'orderDetail', orderId, requestId };
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
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const notificationId = response?.notification?.request?.identifier;
      const data = response?.notification?.request?.content?.data;
      handleNotificationNavigation(data, notificationId);
    });
    (async () => {
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        const notificationId = lastResponse?.notification?.request?.identifier;
        const data = lastResponse?.notification?.request?.content?.data;
        handleNotificationNavigation(data, notificationId);
      }
    })();
    return () => sub.remove();
  }, [handleNotificationNavigation]);

  return (
    <Host>
      <ToastProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ToastProvider>
    </Host>
  );
}
