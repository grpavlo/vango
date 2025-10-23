// src/components/LocationProvider.js
import React, { createContext, useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [userLocation, setUserLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);

    useEffect(() => {
        let subscription = null; // Змінна для збереження підписки

        const startLocationWatch = async () => {
            try {
                // Запит дозволів на доступ до місцезнаходження
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Дозвіл на місцезнаходження відхилено',
                        'Будь ласка, увімкніть доступ до місцезнаходження в налаштуваннях вашого пристрою.'
                    );
                    setLocationError('Permission denied');
                    setLocationLoading(false);
                    return;
                }

                // Починаємо "слухати" зміни місцезнаходження
                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        distanceInterval: 10, // Мінімальна відстань (у метрах), на яку має зміститися користувач, щоб прийшло оновлення
                    },
                    (location) => {
                        setUserLocation({
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        });
                        setLocationLoading(false);
                    }
                );
            } catch (error) {
                console.error('Error watching user location:', error);
                setLocationError(error.message);
                setLocationLoading(false);
            }
        };

        startLocationWatch();

        // Повертаємо функцію, яка відписується від оновлень при демонтажі компонента
        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    return (
        <LocationContext.Provider value={{ userLocation, locationLoading, locationError }}>
            {children}
        </LocationContext.Provider>
    );
};
