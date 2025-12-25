import React, { useEffect, useMemo, useState } from 'react';
import {View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, TouchableOpacity} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Ionicons} from "@expo/vector-icons";
import {createColorsFromTokens, withAlpha} from "../utils/tokens";
import {serverUrlApi} from "../const/api";
import {useDesignSystem} from "../context/ThemeContext";

// Допоміжна функція для перетворення Blob -> base64
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // reader.result виглядає як "data:image/png;base64,AAAA..."
            // Тому розділяємо по "," і беремо другу частину
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export default function SampleDetailScreen({ route, navigation }) {
    const { sample, routeName, routeDate } = route.params || {};

    const [photoUri, setPhotoUri] = useState(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);
    const [error, setError] = useState(null);
    const {tokens} = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Завантажуємо фото при монтуванні екрану
    useEffect(() => {
        if (sample?.photoId) {
            fetchPhoto(sample.photoId);
        }
    }, [sample]);

    const fetchPhoto = async (photoId) => {
        setLoadingPhoto(true);
        setError(null);

        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                throw new Error('Немає accessToken у SecureStore');
            }

            const response = await fetch(
                `${serverUrlApi}files/${photoId}/content`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Не вдалося завантажити фото: ${response.status}`);
            }

            const blob = await response.blob();
            const base64Data = await blobToBase64(blob);

            const base64Uri = `data:image/jpeg;base64,${base64Data}`;
            setPhotoUri(base64Uri);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingPhoto(false);
        }
    };

    return (
        <View style={styles.container}>

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                <Text style={styles.backText}> Back</Text>
            </TouchableOpacity>

            <View style={styles.infoContainer}>
                {routeName && (
                    <Text style={styles.routeName}>
                        {routeName} — {routeDate}
                    </Text>
                )}

                {/* Інформація про зразок */}
                <Text style={styles.sampleTitle}>
                    {sample?.cargoName} / {sample?.checkpointName}
                </Text>
                <Text style={styles.sampleAddress}>
                    {sample?.address}, {sample?.city}, {sample?.state} {sample?.zipCode}
                </Text>

            </View>

            {/* Блок із фото */}
            <View style={styles.photoContainer}>
                {loadingPhoto && <ActivityIndicator size="large" color={colors.primary} />}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {photoUri && (
                    <Image
                        source={{ uri: photoUri }}
                        style={styles.samplePhoto}
                        resizeMode="cover"
                    />
                )}
            </View>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        fontSize: 16,
        marginBottom:15,
        paddingHorizontal: 16,
    },
    infoContainer: {
        backgroundColor: withAlpha(colors.primary, '10'),
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, '20'),
    },
    routeName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: colors.textSecondary,
    },
    sampleTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
        color: colors.textPrimary,
    },
    sampleAddress: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 6,
    },
    photoContainer: {
        marginTop: 16,
        marginHorizontal: 16,
        minHeight: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    samplePhoto: {
        width: '100%',
        height: 300,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    errorText: {
        color: colors.destructive,
        marginTop: 8,
        textAlign: 'center',
    },
});
