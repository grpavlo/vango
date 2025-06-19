import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AllOrdersScreen from './AllOrdersScreen';
import ActiveOrdersScreen from './ActiveOrdersScreen';
import SettingsScreen from './SettingsScreen';
import { colors } from '../components/Colors';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let name = 'list';
          if (route.name === 'Active') name = 'checkmark';
          if (route.name === 'Settings') name = 'settings';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.green,
      })}
    >
      <Tab.Screen name="All" component={AllOrdersScreen} options={{ title: 'Всі' }} />
      <Tab.Screen name="Active" component={ActiveOrdersScreen} options={{ title: 'Активні' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Налаштування' }} />
    </Tab.Navigator>
  );
}
