import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {serverUrlApi} from "../const/api";
import {Ionicons} from "@expo/vector-icons";
import {Fonts, createColorsFromTokens, withAlpha} from "../utils/tokens";
import {useDesignSystem} from "../context/ThemeContext";

export default function SamplesScreen({navigation}) {
    const [routes, setRoutes] = useState([]);
    const [totalPackages, setTotalPackages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const {tokens} = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        fetchRoutesWithSamples();
    }, []);

    const fetchRoutesWithSamples = async () => {
        setLoading(true);
        setError(null);

        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                throw new Error('Немає accessToken у SecureStore');
            }

            const response = await fetch(serverUrlApi+'routes/me/samples', {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                // Обробляємо випадок, коли запит повертає помилку
                const message = `Помилка при завантаженні: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();

            // Фільтруємо маршрути без samples або з порожнім масивом
            const filtered = data.filter(route => route.samples && route.samples.length > 0);

            // Рахуємо загальну кількість пакетів
            const total = filtered.reduce((sum, route) => sum + route.samples.length, 0);

            setRoutes(filtered);
            setTotalPackages(total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderRouteItem = ({ item }) => {
        return (
            <View style={styles.routeContainer}>

                <Text style={styles.routeDate}>{item.date}</Text>
                <Text style={styles.routeName}>
                    {item.name} ({item.samples.length} pcs)
                </Text>

                {/* Відображаємо зразки */}
                {item.samples.map(sample => (
                    <TouchableOpacity
                        key={sample.id}
                        style={styles.sampleItem}
                        onPress={() =>handleSamplePress(item, sample)}
                    >
                        <Text style={styles.sampleTitle}>
                            {sample.cargoName} / {sample.checkpointName}
                        </Text>
                        <Text style={styles.sampleAddress}>
                            {sample.address}, {sample.city}, {sample.state} {sample.zipCode}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const handleSamplePress = (routeItem, sample) => {
        // Передаємо і зразок, і додаткову інформацію про маршрут
        navigation.navigate('SampleDetailScreen', {
            sample,
            routeName: routeItem.name,
            routeDate: routeItem.date
        });
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Помилка: {error}</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    <Text style={styles.backText}> Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerText}>You have <Text style={styles.headerCount}>{totalPackages}</Text> packages</Text>

                <FlatList
                    data={routes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRouteItem}
                    contentContainerStyle={styles.listContent}
                />
            </View>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 16,
        paddingTop: 50,
    },
    headerText: {
        fontSize: Fonts.f36,
        fontWeight: '600',
        marginBottom: 16,
        color: colors.textPrimary,
    },
    headerCount: {
        fontSize: Fonts.f36,
        fontWeight: '600',
        color: colors.primary,
    },
    routeContainer: {
        marginBottom: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
    },
    routeDate: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 4,
    },
    routeName: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    sampleItem: {
        backgroundColor: withAlpha(colors.primary, '12'),
        padding: 10,
        borderRadius: 10,
        marginBottom: 8,
    },
    sampleTitle: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    sampleAddress: {
        color: colors.textSecondary,
        marginTop: 2,
        fontSize: Fonts.f12,
    },
    listContent: {
        paddingBottom: 24,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    errorText: {
        color: colors.destructive,
        fontWeight: '600',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backText: {
        color: colors.textPrimary,
        marginLeft: 6,
        fontSize: Fonts.f14,
    },
});
