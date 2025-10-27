import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import polyline from '@mapbox/polyline';
import PropTypes from 'prop-types';
import { LocationContext } from './LocationProvider';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Path, Ellipse, Text as SvgText } from 'react-native-svg';

// Мінімалістичний стиль (приклад, ви можете змінити під свої потреби)
const customMapStyle = [
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "road",
        "elementType": "labels.icon",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "administrative",
        "stylers": [{ "visibility": "simplified" }, { "lightness": 20 }]
    },
    {
        "featureType": "water",
        "stylers": [{ "visibility": "simplified" }, { "lightness": 20 }]
    },
    {
        "featureType": "road",
        "stylers": [{ "visibility": "simplified" }, { "lightness": 20 }]
    },
    {
        "featureType": "landscape",
        "stylers": [{ "visibility": "simplified" }, { "lightness": 20 }]
    },
    {
        "featureType": "poi.park",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#333333" }]
    },
    {
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#ffffff" }]
    },
];

const COMPLETED_MARKER_COLOR = '#22C55E';
const UPCOMING_MARKER_COLOR = '#F97316';
const SELECTED_INNER_FILL = '#ECFDF5';
const DEFAULT_INNER_FILL = '#FFFFFF';
const COMPLETED_TEXT_COLOR = '#166534';
const UPCOMING_TEXT_COLOR = '#7C2D12';
const ROUTE_STROKE_COLOR = '#2563EB';
const ROUTE_STROKE_WIDTH = 4;

function getClosestPointIndex(userLoc, points) {
    if (!userLoc || !points || points.length === 0) {
        return 0;
    }
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < points.length; i++) {
        const dLat = points[i].latitude - userLoc.latitude;
        const dLng = points[i].longitude - userLoc.longitude;
        const distance = dLat * dLat + dLng * dLng; // просте порівняння без sqrt
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }
    return closestIndex;
}

const GoogleMapComponent = ({
                                keyMap,
                                origin,
                                destination = null,
                                waypoints = [],
                                encodedRoute = null,
                                navigator = false,
                                onMarkerPress = () => {},
                                selectedCheckpointId = null,
                                onOptimizeRoute = null,
                                routeRegion = null,
                                routeCoordinates = [],
                            }) => {
    const mapRef = useRef(null);
    const { userLocation, locationLoading, locationError } = useContext(LocationContext);
    const isFocused = useIsFocused();

    const selectedIdString = useMemo(() => {
        if (selectedCheckpointId === null || selectedCheckpointId === undefined) {
            return null;
        }
        return String(selectedCheckpointId);
    }, [selectedCheckpointId]);



    // Розкодовуємо передану полілінію (якщо є)
    const [decodedPolyline, setDecodedPolyline] = useState(
        encodedRoute
            ? polyline.decode(encodedRoute).map(([latitude, longitude]) => ({ latitude, longitude }))
            : []
    );

    // Зберігаємо поточний маршрут (залежно від navigator)
    const [activeRoute, setActiveRoute] = useState(
        encodedRoute && decodedPolyline.length > 0
            ? decodedPolyline
            : [origin, ...waypoints, destination]
    );

    // Відцентровуємо мапу при першому рендері чи зміні залежностей
    useEffect(() => {
        if (!mapRef.current || navigator) {
            return;
        }

        if (routeRegion) {
            mapRef.current.animateToRegion(routeRegion, 450);
            return;
        }

        let coordinates = [];

        if (encodedRoute && decodedPolyline.length > 0) {
            coordinates = decodedPolyline;
        } else if (routeCoordinates && routeCoordinates.length > 0) {
            coordinates = routeCoordinates;
        } else if (destination) {
            coordinates = [origin, ...waypoints, destination];
        } else {
            coordinates = [origin, ...waypoints];
        }

        if (coordinates.length > 0) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    }, [keyMap, mapRef, isFocused, origin, destination, waypoints, encodedRoute, decodedPolyline, navigator, routeRegion, routeCoordinates]);

    // Якщо увімкнено навігацію, слідкуємо за зміною location
    useEffect(() => {
        if (navigator && userLocation && activeRoute.length > 1) {
            // Знаходимо найближчу точку до userLocation
            const closestIndex = getClosestPointIndex(userLocation, activeRoute);
            // Обрізаємо все, що позаду
            const newRoute = activeRoute.slice(closestIndex);
            setActiveRoute(newRoute);

            // Масштабуємося на новий активний маршрут
            if (mapRef.current && newRoute.length > 0) {
                const coords = [userLocation, ...newRoute];
                mapRef.current.fitToCoordinates(coords, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });

                mapRef.current.animateToRegion(
                    {
                        ...userLocation,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    },
                    500
                );
            }
        }
    }, [navigator, userLocation]);

    // Функція повернення до поточної локації
    const handleRecenter = () => {
        if (mapRef.current && userLocation) {
            mapRef.current.animateToRegion(
                {
                    ...userLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                500
            );
            return;
        }

        if (mapRef.current && routeRegion) {
            mapRef.current.animateToRegion(routeRegion, 450);
        }
    };

    useEffect(() => {
        if (!mapRef.current || !selectedIdString) {
            return;
        }

        const selectedPoint = waypoints.find((checkpoint) => {
            if (!checkpoint) {
                return false;
            }
            const checkpointIdString = checkpoint.id === null || checkpoint.id === undefined
                ? null
                : String(checkpoint.id);

            return checkpointIdString === selectedIdString;
        });

        if (selectedPoint) {
            mapRef.current.animateToRegion(
                {
                    latitude: selectedPoint.latitude,
                    longitude: selectedPoint.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                500
            );
        }
    }, [selectedIdString, waypoints]);

    // Якщо змінилася encodedRoute, оновлюємо decodedPolyline
    useEffect(() => {
        if (encodedRoute) {
            const decoded = polyline.decode(encodedRoute).map(([latitude, longitude]) => ({ latitude, longitude }));
            setDecodedPolyline(decoded);
        }
    }, [encodedRoute]);

    // Якщо триває завантаження локації
    if (locationLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Determining your location...</Text>
            </View>
        );
    }

    // Якщо сталась помилка
    if (locationError) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>The location could not be determined.</Text>
            </View>
        );
    }

    // Рендеримо індивідуальний SVG Marker
    const renderMarkerIcon = ({ isCompleted, sequence, isSelected }) => {
        const markerColor = isCompleted ? COMPLETED_MARKER_COLOR : UPCOMING_MARKER_COLOR;
        const textColor = isCompleted ? COMPLETED_TEXT_COLOR : UPCOMING_TEXT_COLOR;
        const innerFill = isSelected ? SELECTED_INNER_FILL : DEFAULT_INNER_FILL;
        const labelNumber = Number(sequence);
        const label = Number.isFinite(labelNumber) && labelNumber > 0 ? String(labelNumber) : '';
        const width = isSelected ? 28 : 24;
        const height = isSelected ? 44 : 38;

        return (
            <Svg width={width} height={height} viewBox="0 0 24 36" fill="none">
                <Path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12.0001 0.5C6.20188 0.5 1.50012 5.20176 1.50012 11C1.50012 18.4795 8.34734 28.1278 11.0491 31.6086C11.5563 32.2518 12.4439 32.2518 12.9511 31.6086C15.6529 28.1278 22.5001 18.4795 22.5001 11C22.5001 5.20176 17.7983 0.5 12.0001 0.5Z"
                    fill={markerColor}
                    stroke={isSelected ? markerColor : markerColor}
                    strokeWidth={isSelected ? 0.4 : 0}
                />
                <Ellipse
                    cx="12"
                    cy="11.8"
                    rx="6"
                    ry="6.2"
                    fill={innerFill}
                    stroke={isSelected ? markerColor : markerColor}
                    strokeWidth={isSelected ? 0.6 : 0}
                />
                {label ? (
                    <SvgText
                        fill={textColor}
                        fontSize={isSelected ? 12 : 11}
                        fontWeight="bold"
                        x="12"
                        y="12.3"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                    >
                        {label}
                    </SvgText>
                ) : null}
            </Svg>
        );
    };

    const initialRegion = routeRegion
        ? routeRegion
        : {
            latitude: origin.latitude,
            longitude: origin.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        };

    return (
        <View key={keyMap} style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={!!userLocation}
                showsMyLocationButton={false}
                customMapStyle={customMapStyle}
                // provider={PROVIDER_GOOGLE}
            >
                {destination && (
                    <Marker
                        coordinate={destination}
                        title="Destination"
                    >
                        {renderMarkerIcon({ isCompleted: false, sequence: null, isSelected: false })}
                    </Marker>
                )}

                {waypoints.length > 0 &&
                    waypoints.map((checkpoint, index) => {
                        if (!checkpoint || typeof checkpoint.latitude !== 'number' || typeof checkpoint.longitude !== 'number') {
                            return null;
                        }

                        const checkpointIdString = checkpoint.id === null || checkpoint.id === undefined
                            ? null
                            : String(checkpoint.id);
                        const isCompleted = Boolean(checkpoint.isCompleted || checkpoint.color === 'blue');
                        const sequence = checkpoint.sequence ?? index + 1;
                        const isSelected = Boolean(selectedIdString && checkpointIdString === selectedIdString);

                        return (
                            <Marker
                                key={checkpoint.id ?? `waypoint-${index}`}
                                coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }}
                                onPress={() => onMarkerPress(checkpoint)}
                            >
                                {renderMarkerIcon({ isCompleted, sequence, isSelected })}
                            </Marker>
                        );
                    })}

                {(destination && decodedPolyline) ? (
                    <Polyline
                        coordinates={navigator ? activeRoute : (encodedRoute ? decodedPolyline : [origin, ...waypoints, destination])}
                        strokeColor={ROUTE_STROKE_COLOR}
                        strokeWidth={ROUTE_STROKE_WIDTH}
                    />
                ) : (
                    <Polyline
                        coordinates={navigator ? activeRoute : (encodedRoute ? decodedPolyline : [origin, ...waypoints])}
                        strokeColor={ROUTE_STROKE_COLOR}
                        strokeWidth={ROUTE_STROKE_WIDTH}
                    />
                )}
            </MapView>

            <View style={styles.mapControlsContainer} pointerEvents="box-none">
                <TouchableOpacity style={styles.mapControlButton} onPress={handleRecenter}>
                    <Ionicons name="navigate-outline" size={18} color="#1F2937" style={styles.mapControlIcon} />
                    <Text style={styles.mapControlText}>Re-center</Text>
                </TouchableOpacity>
                {/*{typeof onOptimizeRoute === 'function' && (*/}
                {/*    <TouchableOpacity style={[styles.mapControlButton, styles.mapControlAccentButton]} onPress={onOptimizeRoute}>*/}
                {/*        <MaterialCommunityIcons name="routes" size={18} color="#FFFFFF" style={styles.mapControlIcon} />*/}
                {/*        <Text style={[styles.mapControlText, styles.mapControlAccentText]}>Smart Route</Text>*/}
                {/*    </TouchableOpacity>*/}
                {/*)}*/}
            </View>
        </View>
    );
};

GoogleMapComponent.propTypes = {
    origin: PropTypes.shape({
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
    }).isRequired,
    destination: PropTypes.shape({
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
    }),
    waypoints: PropTypes.arrayOf(
        PropTypes.shape({
            latitude: PropTypes.number.isRequired,
            longitude: PropTypes.number.isRequired,
        })
    ),
    encodedRoute: PropTypes.string,
    onMapReady: PropTypes.func,
    navigator: PropTypes.bool,
    onMarkerPress: PropTypes.func,
    selectedCheckpointId: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
    ]),
    onOptimizeRoute: PropTypes.func,
    routeRegion: PropTypes.shape({
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
        latitudeDelta: PropTypes.number.isRequired,
        longitudeDelta: PropTypes.number.isRequired,
    }),
    routeCoordinates: PropTypes.arrayOf(
        PropTypes.shape({
            latitude: PropTypes.number.isRequired,
            longitude: PropTypes.number.isRequired,
        })
    ),
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    mapControlsContainer: {
        position: 'absolute',
        right: 16,
        bottom: 20,
        alignItems: 'flex-end',
        gap: 12,
    },
    mapControlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowColor: 'rgba(0,0,0,0.25)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    mapControlIcon: {
        marginRight: 8,
    },
    mapControlText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    mapControlAccentButton: {
        backgroundColor: '#F97316',
        shadowColor: 'rgba(249, 115, 22, 0.4)',
    },
    mapControlAccentText: {
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#555',
    },
});

export default GoogleMapComponent;
