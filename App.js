import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import OrdersScreen from './screens/OrdersScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [token, setToken] = useState(null);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!token ? (
          <Stack.Screen name="Login" options={{ title: 'Login' }}>
            {props => <LoginScreen {...props} setToken={setToken} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Orders" options={{ title: 'Orders' }}>
            {props => <OrdersScreen {...props} token={token} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
