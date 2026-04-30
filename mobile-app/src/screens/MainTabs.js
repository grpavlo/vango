import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AllOrdersScreen from './AllOrdersScreen';
import CreateOrderScreen from './CreateOrderScreen';
import SettingsScreen from './SettingsScreen';
import { colors } from '../components/Colors';
import MyOrdersScreen from './MyOrdersScreen';
import { useAuth } from '../AuthContext';
import { getHasUnreadOrderUpdates, subscribeOrderUpdates } from '../orderUpdates';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { role, token } = useAuth();
  const [hasUnreadMyOrders, setHasUnreadMyOrders] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function refreshBadge() {
      if (!role || !token) {
        if (mounted) setHasUnreadMyOrders(false);
        return;
      }
      const hasUnread = await getHasUnreadOrderUpdates(role, token);
      if (mounted) setHasUnreadMyOrders(hasUnread);
    }

    refreshBadge();
    const unsubscribe = subscribeOrderUpdates(refreshBadge);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [role, token]);

  const myOrdersOptions = {
    title: 'Мої замовлення',
    tabBarBadge: hasUnreadMyOrders ? ' ' : undefined,
    tabBarBadgeStyle: {
      backgroundColor: '#DC2626',
      color: 'transparent',
      minWidth: 10,
      height: 10,
      borderRadius: 5,
    },
  };

  return (
    <Tab.Navigator
      key={role}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let name = 'list';
          if (route.name === 'Create') name = 'add-circle';
          if (route.name === 'All') name = 'list';
          if (route.name === 'MyOrders') name = 'briefcase';
          if (route.name === 'Settings') name = 'settings';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTitleAlign: 'center',
      })}
    >
      {role === 'CUSTOMER' ? (
        <>
          <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={myOrdersOptions} />
          <Tab.Screen name="Create" component={CreateOrderScreen} options={{ title: 'Створити' }} />
        </>
      ) : (
        <>
          <Tab.Screen
            name="All"
            component={AllOrdersScreen}
            options={{ headerShown: false, title: 'Всі', tabBarLabel: 'Всі' }}
          />
          <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={myOrdersOptions} />
        </>
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Налаштування' }} />
    </Tab.Navigator>
  );
}

