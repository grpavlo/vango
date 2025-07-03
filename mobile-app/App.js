import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ToastProvider } from './src/components/Toast';
import { AuthProvider, useAuth } from './src/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoleScreen from './src/screens/RoleScreen';
import MainTabs from './src/screens/MainTabs';
import MapSelectScreen from './src/screens/MapSelectScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import EditOrderScreen from './src/screens/EditOrderScreen';
import * as Notifications from 'expo-notifications';
import { navigationRef, navigate } from './src/navigationRef';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { token, role, loading } = useAuth();

  if (loading) return null;

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
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const responseListener = useRef();

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const id = response.notification.request.content.data.orderId;
        if (id) {
          navigate('OrderDetail', { orderId: id });
        }
      }
    );
    return () => {
      if (responseListener.current)
        Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <ToastProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ToastProvider>
  );
}
