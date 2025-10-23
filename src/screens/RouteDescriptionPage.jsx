import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import { Colors, Fonts } from '../utils/tokens';
import * as SecureStore from 'expo-secure-store';
import {Ionicons} from "@expo/vector-icons";
import {WebView} from "react-native-webview";
import {serverUrlApi} from "../const/api";

const RouteDescriptionPage = ({ navigation, route }) => {
    const { idRoute, name } = route.params || { idRoute: null, name: "" };
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

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
        <View style={{ flex: 1 }}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={Colors.mainBlue} />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
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
        color: Colors.blackText,
        marginLeft: 5,
    },
    title: {
        fontSize: Fonts.f20,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 20,
    },
    description: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
    },
    errorText: {
        color: Colors.mainRed,
        fontSize: Fonts.f14,
        marginBottom: 10,
        textAlign: 'center',
    },
});

export default RouteDescriptionPage;
