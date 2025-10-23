// App.js
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { serverUrlApi } from './src/const/api';

// Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import SignIn from './src/screens/SignIn';
import ForgotPasswordPage from './src/screens/ForgotPasswordPage';
import VerificationCodePage from './src/screens/VerificationCodePage';
import SuccessPage from './src/screens/SuccessPage';
import NewPasswordPage from './src/screens/NewPasswordPage';
import PasswordSetPage from './src/screens/PasswordSetPage';
import RoutesPage from './src/screens/RoutesPage';
import RouteCheckpointsPage from './src/screens/RouteCheckpointsPage';
import ChooseCarPage from './src/screens/ChooseCarPage';
import RouteCheckpointsPageSelect from './src/screens/RouteCheckpointsPageSelect';
import ActionListsPage from './src/screens/ActionListsPage';
import CheckpointViewPage from './src/screens/CheckpointViewPage';
import RouteDescriptionPage from './src/screens/RouteDescriptionPage';
import EntryInstructionsPage from './src/screens/EntryInstructionsPage';
import ChatComponent from './src/screens/ChatComponent';
import WorkOnVisitPage from './src/screens/WorkOnVisitPage';
import ConfirmUploadPage from './src/screens/ConfirmUploadPage';
import ClosedOfficeFormPage from './src/screens/ClosedOfficeFormPage';
import NoSamplesFormPage from './src/screens/NoSamplesFormPage';
import MapPage from './src/screens/mapPage';
import SettingsPage from './src/screens/SettingsPage';
import ChangePasswordPage from './src/screens/ChangePasswordPage';
import NotificationsScreen from './src/screens/NotificationsScreen';
import SamplesScreen from './src/screens/SamplesPage';
import SampleDetailScreen from './src/screens/SampleDetailScreen';

// Contexts
import { LocationProvider } from './src/components/LocationProvider';

const Stack = createNativeStackNavigator();

export default function App() {
    const [isReady, setIsReady] = useState(false);
    const [initialRoute, setInitialRoute] = useState(null);
    const navRef = useRef();
    const refreshTimeout = useRef(null);


    // Helper to get active route name in nested navigator
    const getActiveRouteName = (state) => {
        const route = state.routes[state.index];
        return route.state ? getActiveRouteName(route.state) : route.name;
    };

    useEffect(() => {

        const storeTokens = async (accessToken, refreshToken, userId) => {
            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', refreshToken);
            await SecureStore.setItemAsync('userId', userId);

        };

        const scheduleRefresh = (expiresIn, currentRefreshToken) => {
            if (refreshTimeout.current) {
                clearTimeout(refreshTimeout.current);
            }
            refreshTimeout.current = setTimeout(() => {
                refreshToken(currentRefreshToken);
            }, expiresIn * 1000);
        };

        const refreshToken = async (currentRefreshToken) => {
            try {
                const response = await fetch(serverUrlApi+'auth/refresh', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        refreshToken: currentRefreshToken
                    })
                });
                if (response.status === 200) {
                    const data = await response.json();
                    await storeTokens(data.accessToken, data.refreshToken, data.userId);
                    scheduleRefresh(data.expiresIn, data.refreshToken);
                    setInitialRoute('RoutesPage');

                }else {
                    setInitialRoute('WelcomeScreen');
                }
            } catch (error) {}
        };

        async function restoreAppState() {
            try {
                const token = await SecureStore.getItemAsync('accessToken');
                const currentRefreshToken = await SecureStore.getItemAsync('refreshToken');

                if (token && currentRefreshToken) {
                    try {
                        refreshToken(currentRefreshToken)
                    } catch {}
                }else {
                    setInitialRoute('WelcomeScreen');
                }

            } catch (e) {
                console.warn('Error restoring app state:', e);
                setInitialRoute('WelcomeScreen');
            } finally {
                setIsReady(true);
            }
        }
        restoreAppState();
    }, []);

    if (!isReady || initialRoute === null) {
        return <ActivityIndicator style={{ flex: 1 }} size="large" />;
    }

    return (
        <SafeAreaProvider>
            <LocationProvider>
                <StatusBar />
                <SafeAreaView style={styles.safeArea}>
                    <NavigationContainer
                        ref={navRef}
                        onStateChange={(state) => {
                            const currentRoute = getActiveRouteName(state);
                            AsyncStorage.setItem('lastRoute', currentRoute);
                        }}
                    >
                        <Stack.Navigator
                            initialRouteName={initialRoute}
                            screenOptions={{ headerShown: false, animation: 'none' }}
                        >
                            <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
                            <Stack.Screen name="SignIn" component={SignIn} />
                            <Stack.Screen name="ForgotPasswordPage" component={ForgotPasswordPage} />
                            <Stack.Screen name="VerificationCodePage" component={VerificationCodePage} />
                            <Stack.Screen name="SuccessPage" component={SuccessPage} />
                            <Stack.Screen name="NewPasswordPage" component={NewPasswordPage} />
                            <Stack.Screen name="PasswordSetPage" component={PasswordSetPage} />
                            <Stack.Screen name="RoutesPage" component={RoutesPage} />
                            <Stack.Screen name="RouteCheckpointsPage" component={RouteCheckpointsPage} />
                            <Stack.Screen name="ChooseCarPage" component={ChooseCarPage} />
                            <Stack.Screen name="RouteCheckpointsPageSelect" component={RouteCheckpointsPageSelect} />
                            <Stack.Screen name="ActionListsPage" component={ActionListsPage} />
                            <Stack.Screen name="CheckpointViewPage" component={CheckpointViewPage} />
                            <Stack.Screen name="RouteDescriptionPage" component={RouteDescriptionPage} />
                            <Stack.Screen name="EntryInstructionsPage" component={EntryInstructionsPage} />
                            <Stack.Screen name="ChatComponent" component={ChatComponent} />
                            <Stack.Screen name="WorkOnVisitPage" component={WorkOnVisitPage} />
                            <Stack.Screen name="ConfirmUploadPage" component={ConfirmUploadPage} />
                            <Stack.Screen name="ClosedOfficeFormPage" component={ClosedOfficeFormPage} />
                            <Stack.Screen name="NoSamplesFormPage" component={NoSamplesFormPage} />
                            <Stack.Screen name="MapPage" component={MapPage} />
                            <Stack.Screen name="SettingsPage" component={SettingsPage} />
                            <Stack.Screen name="ChangePasswordPage" component={ChangePasswordPage} />
                            <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
                            <Stack.Screen name="SamplesScreen" component={SamplesScreen} />
                            <Stack.Screen name="SampleDetailScreen" component={SampleDetailScreen} />
                        </Stack.Navigator>
                    </NavigationContainer>
                </SafeAreaView>
            </LocationProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
});
