import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AllOrdersScreen from './AllOrdersScreen';
import CreateOrderScreen from './CreateOrderScreen';
import SettingsScreen from './SettingsScreen';
import { colors } from '../components/Colors';
import MyOrdersScreen from './MyOrdersScreen';
import { useAuth } from '../AuthContext';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { role } = useAuth();

  return (
    <Tab.Navigator
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
          <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'Мої замовлення' }} />
          <Tab.Screen name="Create" component={CreateOrderScreen} options={{ title: 'Створити' }} />
        </>
      ) : (
        <>
          <Tab.Screen name="All" component={AllOrdersScreen} options={{ title: 'Всі' }} />
          <Tab.Screen name="MyOrders" component={MyOrdersScreen} options={{ title: 'Мої замовлення' }} />
        </>
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Налаштування' }} />
    </Tab.Navigator>
  );
}
