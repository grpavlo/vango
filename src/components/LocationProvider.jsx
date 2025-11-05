import React, { createContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { showAppAlert } from '../store/useAppAlertStore';

export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
    const [userLocation, setUserLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);

    useEffect(() => {
        let subscription;

        const startLocationWatch = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    showAppAlert({
                        title: 'Location Permission Needed',
                        message:
                            'Please allow access to your location so we can provide accurate routing and checkpoint updates.',
                        variant: 'warning',
                    });
                    setLocationError('Permission denied');
                    setLocationLoading(false);
                    return;
                }

                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        distanceInterval: 10,
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

