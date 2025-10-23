import React, {useContext, useEffect, useRef, useState} from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
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

let countBlue = 0
let countRed = 0
const GoogleMapComponent = ({
                                keyMap,
                                origin,
                                destination = null,
                                waypoints = [],
                                encodedRoute = null,
                                navigator = false,
                                onMarkerPress = () => {}
                            }) => {
    const mapRef = useRef(null);
    const { userLocation, locationLoading, locationError } = useContext(LocationContext);
    const isFocused = useIsFocused();



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
        countBlue = 0
        countRed = 0
        if (mapRef.current && !navigator) {
            let coordinates = [];

            if (encodedRoute && decodedPolyline.length > 0) {
                coordinates = decodedPolyline;
            } else {
                if (destination) {
                    coordinates = [origin, ...waypoints, destination];
                } else {
                    coordinates = [origin, ...waypoints];
                }
            }

            if (userLocation) {
                coordinates = [...coordinates, userLocation];
            }

            if (coordinates.length > 0) {
                mapRef.current.fitToCoordinates(coordinates, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                });
            }
        }
    }, [keyMap, mapRef, isFocused, origin, destination, waypoints, encodedRoute, decodedPolyline, navigator, userLocation]);

    // Якщо увімкнено навігацію, слідкуємо за зміною location
    useEffect(() => {
        countBlue = 0
        countRed = 0
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
        }
    };

    // Якщо змінилася encodedRoute, оновлюємо decodedPolyline
    useEffect(() => {
        countBlue = 0
        countRed = 0
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
    const renderMarkerIcon = (color, index) => {
        if(index===0){
            countBlue = 0
            countRed = 0
        }
        if (color === 'red') {

            countRed+=1

            return (
                <Svg width="21" height="36" viewBox="0 0 21 36" fill="none">
                    <Path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M11.1719 22.9599C16.2252 22.4057 20.1719 17.6965 20.1719 11.9691C20.1719 5.86898 15.6947 0.923828 10.1719 0.923828C4.64903 0.923828 0.171875 5.86898 0.171875 11.9691C0.171875 17.6965 4.11855 22.4057 9.17188 22.9599V34.1644C9.17188 34.7167 9.61959 35.1644 10.1719 35.1644C10.7242 35.1644 11.1719 34.7167 11.1719 34.1644V22.9599Z"
                        fill="#C91C1C"
                    />
                    <Ellipse cx="10.1719" cy="11.968" rx="5" ry="5.52265" fill="white" />
                    <SvgText
                        fill="black"
                        fontSize="12"
                        fontWeight="bold"
                        x="10.1719"
                        y="12"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                    >
                        {index !==9999 && countRed}
                    </SvgText>
                </Svg>
            );
        } else {

            countBlue+=1

            return (
                <Svg width="23" height="35" viewBox="0 0 23 35" fill="none">
                    <Path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12.3135 22.5426C17.8223 22.0613 22.1473 17.3179 22.1473 11.5375C22.1473 5.43734 17.3307 0.492188 11.3891 0.492188C5.44748 0.492188 0.630859 5.43734 0.630859 11.5375C0.630859 17.2649 4.87689 21.9742 10.3135 22.5283V33.7329C10.3135 34.2852 10.7612 34.7329 11.3135 34.7329C11.8658 34.7329 12.3135 34.2852 12.3135 33.7329V22.5426Z"
                        fill="#1976D2"
                    />
                    <Ellipse cx="11.3889" cy="11.5363" rx="5.37912" ry="5.52265" fill="white" />
                    <SvgText
                        fill="black"
                        fontSize="12"
                        fontWeight="bold"
                        x="11.3889"
                        y="12"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                    >
                        {countBlue}
                    </SvgText>
                </Svg>
            );
        }
    };

    return (
        <View key={keyMap} style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
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
                        {renderMarkerIcon('red', 9999) }
                    </Marker>
                )}

                {waypoints.length > 0 &&
                    waypoints.map((coordinate, index) => {
                        if(coordinate){
                            return (
                                <Marker
                                    key={index}
                                    coordinate={coordinate}
                                    onPress={() => {
                                        if(coordinate.color === "red"){
                                            onMarkerPress(coordinate)
                                        }

                                    }}
                                >
                                    {renderMarkerIcon(coordinate.color || 'red', index)}
                                </Marker>
                            )
                        }else {
                            return null
                        }
                    })}

                {(destination && decodedPolyline) ? (
                    <Polyline
                        coordinates={navigator ? activeRoute : (encodedRoute ? decodedPolyline : [origin, ...waypoints, destination])}
                        strokeColor="#007AFF"
                        strokeWidth={3}
                    />
                ) : (
                    <Polyline
                        coordinates={navigator ? activeRoute : (encodedRoute ? decodedPolyline : [origin, ...waypoints])}
                        strokeColor="#007AFF"
                        strokeWidth={3}
                    />
                )}
            </MapView>

            <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
                <Text style={styles.recenterButtonText}>Re-centre</Text>
            </TouchableOpacity>
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
    onMarkerPress: PropTypes.func
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    recenterButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    recenterButtonText: {
        color: '#007AFF',
        fontWeight: '600',
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
