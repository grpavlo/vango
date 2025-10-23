import React, { useEffect, useState } from 'react';
import {View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, TouchableOpacity} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Ionicons} from "@expo/vector-icons";
import {Colors} from "../utils/tokens";
import {serverUrlApi} from "../const/api";

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
                <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
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
                {loadingPhoto && <ActivityIndicator size="large" color="#000" />}
                {error && <Text style={{ color: 'red' }}>{error}</Text>}

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        color: '#007AFF',
        fontSize: 16,
        marginBottom:15
    },
    infoContainer: {
        backgroundColor: '#eee',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 8,
    },
    routeName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    sampleTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    sampleAddress: {
        fontSize: 14,
        color: '#333',
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
    },

});
