import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import { Fonts, createColorsFromTokens } from '../utils/tokens';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { serverUrlApi } from "../const/api";
import { useDesignSystem } from "../context/ThemeContext";

const RouteDescriptionPage = ({ navigation, route }) => {
    const { idRoute, name } = route.params || { idRoute: null, name: "" };
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        const fetchDescription = async () => {
            if (!idRoute) {
                setErrorMessage('Route ID is missing.');
                setLoading(false);
                return;
            }
            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) {
                    setErrorMessage('Authentication token is missing. Please log in again.');
                    setLoading(false);
                    return;
                }
                const response = await fetch(serverUrlApi+`routes/${idRoute}/description`, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                if (response.status === 200) {
                    const data = await response.json();
                    setDescription(data || 'No description available.');
                } else if (response.status === 401) {
                    setErrorMessage('Unauthorized access. Please log in again.');
                } else if (response.status === 404) {
                    setErrorMessage('Route description not found.');
                } else {
                    setErrorMessage('Failed to fetch route description.');
                }
            } catch (error) {
                setErrorMessage('An error occurred while fetching the description. Please try again.');
            }
            setLoading(false);
        };
        fetchDescription();
    }, [idRoute]);

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                    <>
                        {errorMessage ? (
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        ) : (
                            <>
                                <Text style={styles.title}>{name}</Text>
                                <Text style={styles.subtitle}>Description of the route</Text>

                                <WebView
                                    style={styles.webView}
                                    originWhitelist={['*']}
                                    source={{ html: description }}
                                />
                            </>
                        )}
                    </>
                )}
            </View>
            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontSize: Fonts.f14,
        color: colors.textPrimary,
        marginLeft: 5,
    },
    title: {
        fontSize: Fonts.f20,
        color: colors.primary,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: colors.textSecondary,
        marginBottom: 20,
    },
    description: {
        fontSize: Fonts.f14,
        color: colors.textPrimary,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 10,
        overflow: 'hidden',
    },
    errorText: {
        color: colors.destructive,
        fontSize: Fonts.f14,
        marginBottom: 10,
        textAlign: 'center',
    },
});

export default RouteDescriptionPage;
