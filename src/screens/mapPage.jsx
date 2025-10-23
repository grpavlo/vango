import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import {Colors, Fonts} from "../utils/tokens";
import {useEffect, useState} from "react";
import GoogleMapComponent from "../components/GoogleMapComponent";
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import UniversalModal from "../components/UniversalModal";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import {handleCallPress} from "../function/handleCallPress";
import {serverUrlApi} from "../const/api";
import {useInfoCheckpoint} from "../store/infoCheckpoint";

const GOOGLE_API_KEY = 'AIzaSyA8Gs9cDcKHTrC83D_GaBVeP2yCfA_Doxs'; // замініть на ваш дійсний ключ

export default function MapPage({navigation}) {
    const [modalVisible, setModalVisible] = useState(false);
    const [key, setKey] = useState(null);
    const [origin, setOrigin] = useState(null);

    // Основні точки маршруту (без isDefaultUnload)
    const [waypoints, setWaypoints] = useState([]);
    // Точка з isDefaultUnload, яку виводимо окремо і не враховуємо в розрахунку
    const [unloadPoint, setUnloadPoint] = useState(null);

    const [encodedRoute, setEncodedRoute] = useState(null);
    const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
    const [routeName, setRouteName] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [navigator, setNavigator] = useState(false);
    const [idRoute, setIdRoute] = useState(null);
    const [arrivalTime, setArrivalTime] = useState(null);

    // ID of the checkpoint user selected for start visit
    const [idCheckpoint, setIdCheckpoint] = useState(null);
    const [checkpointData, setCheckpointData] = useState(null);

    const {setData} = useInfoCheckpoint();


    // Функція форматування годин
    const formatHours = (startSeconds, endSeconds) => {
        const startTimeDate = new Date(0);
        startTimeDate.setSeconds(startSeconds);
        const endTimeDate = new Date(0);
        endTimeDate.setSeconds(endSeconds);
        const startHours = startTimeDate.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const endHours = endTimeDate.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${startHours} - ${endHours}`;
    };

    useEffect(() => {
        const fetchRoute = async () => {
            try {
                const idRouteStorage = await SecureStore.getItemAsync('idRoute');

                // Отримання геолокації користувача
                try {
                    const userLocation = await Location.getCurrentPositionAsync({});
                    const userLat = userLocation.coords.latitude;
                    const userLng = userLocation.coords.longitude;
                    setOrigin({latitude: userLat, longitude: userLng});

                    if (!idRouteStorage) {
                        setErrorMessage("First you need to start the route.");
                        return;
                    }
                    setIdRoute(idRouteStorage);

                    const accessToken = await SecureStore.getItemAsync('accessToken');
                    if (!accessToken) {
                        setErrorMessage('Authentication token is missing. Please log in again.');
                        return;
                    }

                    const response = await fetch(serverUrlApi + `routes/${idRouteStorage}`, {
                        method: 'GET',
                        headers: {
                            'accept': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });

                    if (response.status === 200) {
                        const data = await response.json();
                        setRouteName(data.name);

                        let completedVisits = data.completedVisits || [];
                        let visits = data.visits || [];

                        // Шукаємо точку з isDefaultUnload
                        let foundUnload = visits.find((v) => v.isDefaultUnload);
                        if (!foundUnload) {
                            foundUnload = completedVisits.find((v) => v.isDefaultUnload);
                        }

                        // Прибираємо цю точку з обох списків, щоб не враховувати її у маршруті
                        if (foundUnload) {
                            visits = visits.filter((v) => !v.isDefaultUnload);
                            completedVisits = completedVisits.filter((v) => !v.isDefaultUnload);
                            setUnloadPoint(foundUnload);
                        }

                        // Формуємо усі решта точок
                        const allWaypoints = [];
                        const handleMakePoint = (visit, color) => {
                            const hours = formatHours(visit.startTime, visit.endTime);
                            return {
                                ...visit,
                                latitude: visit.locationPoint.latitude,
                                longitude: visit.locationPoint.longitude,
                                color: color,
                                id: visit.id,
                                checkpointName: visit.checkpointName,
                                address: visit.address,
                                dropOff: visit.dropOff,
                                name: visit.checkpointName,
                                type: visit.dropOff ? 'unloading' : 'loading',
                                flagColor: color,
                                stat: visit.priority ? 'STAT' : null
                            };
                        };

                        completedVisits.forEach((visit) => {
                            allWaypoints.push(handleMakePoint(visit, 'blue'));
                        });
                        visits.forEach((visit) => {
                            allWaypoints.push(handleMakePoint(visit, 'red'));
                        });

                        setWaypoints(allWaypoints);

                        // Якщо немає взагалі точок після фільтрації
                        if (visits.length === 0) {
                            setErrorMessage('No visits available (or they are all done) to determine the route.');
                            return;
                        }

                        // Формуємо координати для запиту (origin -> [visits] -> end)
                        const waypointCoords = visits
                            .map((visit) => `${visit.locationPoint.latitude},${visit.locationPoint.longitude}`)
                            .join('|');

                        const start = `${userLat},${userLng}`;
                        const lastVisit = visits[visits.length - 1];
                        if (!lastVisit) {
                            setErrorMessage('No visits available to determine the end location.');
                            return;
                        }
                        const end = `${lastVisit.locationPoint.latitude},${lastVisit.locationPoint.longitude}`;

                        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${start}&destination=${end}&waypoints=optimize:false|${waypointCoords}&key=${GOOGLE_API_KEY}`;

                        const directionsResponse = await fetch(directionsUrl);
                        if (!directionsResponse) {
                            setErrorMessage('Failed to fetch directions.');
                            return;
                        }

                        const result = await directionsResponse.json();
                        if (result.status === 'OK') {
                            const route = result.routes[0];
                            const polyline = route.overview_polyline.points;
                            setEncodedRoute(polyline);

                            const totalDurationSec = route.legs.reduce((acc, leg) => acc + leg.duration.value, 0);
                            const now = new Date();
                            const arrivalTimestamp = now.getTime() + totalDurationSec * 1000;
                            const arrivalTime = new Date(arrivalTimestamp);

                            const arrivalTimeFormatted = arrivalTime.toLocaleString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            });
                            setArrivalTime(arrivalTimeFormatted);

                        } else {
                            console.log('Directions API error:', result.status);
                            setEncodedRoute(null);
                        }
                    } else if (response.status === 401) {
                        setErrorMessage('Unauthorized access. Please log in again.');
                    } else if (response.status === 404) {
                        setErrorMessage('Route not found.');
                    } else {
                        setErrorMessage('Failed to fetch route data.');
                    }
                } catch (error) {
                    console.log("Error getting user location:", error);
                }
            } catch (error) {
                console.error(error);
            }
        };
        fetchRoute();
    }, []);

    const handleStartVisit = () => {
        if (!selectedCheckpoint) return;
        setIdCheckpoint(selectedCheckpoint.id);
        setCheckpointData(selectedCheckpoint);
        setModalVisible(true);
    };

    const handleConfirm = async () => {
        try {
            if (!idCheckpoint) {
                setErrorMessage('No checkpoint selected.');
                return;
            }
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                setErrorMessage('Authentication token is missing. Please log in again.');
                return;
            }

            const response = await fetch(serverUrlApi + `visits/${idCheckpoint}/start`, {
                method: 'PATCH',
                headers: {
                    'accept': '*/*',
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(idCheckpoint),
            });

            if (response.status === 200) {
                setModalVisible(false);

                if (checkpointData && checkpointData.dropOff) {
                    navigation.navigate("ConfirmUploadPage");
                } else {
                    navigation.navigate("WorkOnVisitPage", {
                        idCheckpoint,
                        data: checkpointData,
                        routeName,
                        idRoute
                    });
                }
            } else {
                const errorData = await response.json();
                setErrorMessage(errorData.message || 'Failed to start visit.');
            }
        } catch (error) {
            setErrorMessage('An error occurred while starting the visit. Please try again.');
        }
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    const handleGo = () => {
        setData(selectedCheckpoint);

        navigation.navigate('CheckpointViewPage', {
            idCheckpoint: selectedCheckpoint.id,
            data:selectedCheckpoint,
            routeName,
            idRoute
        });
    };

    // Натискання на маркер (звичайні точки)
    const handleMarkerPress = (waypoint) => {
        setSelectedCheckpoint(waypoint);
    };

    // Кнопка Default Point (доступна, якщо існує unloadPoint)
    const handleUnloadPointPress = () => {
        if (!unloadPoint) return;
        // Перехід на перегляд цієї точки або робимо інші дії
        setData(unloadPoint);

        navigation.navigate('CheckpointViewPage', {
            idCheckpoint: unloadPoint.id,
            data: unloadPoint,
            routeName,
            idRoute
        });
    };

    useEffect(() => {
        // При кожному оновленні робимо новий ключ для мапи (щоб примусити ререндер якщо треба)
        setKey(Math.random().toString());
    }, []);

    return (
        <View style={{flex: 1}}>
            <View style={styles.container}>
                <View style={styles.mapContainer}>
                    {(key && origin) && (
                        <GoogleMapComponent
                            origin={origin}
                            waypoints={waypoints}
                            encodedRoute={encodedRoute}
                            onMapReady={() => console.log('Map is ready')}
                            onMarkerPress={handleMarkerPress}
                            navigator={navigator}
                            unloadPoint={unloadPoint}
                            key={key}
                        />
                    )}
                </View>

                {/* Якщо маємо unloadPoint, виводимо кнопку Default Point */}
                {unloadPoint && (
                    <TouchableOpacity
                        style={styles.unloadButton}
                        onPress={handleUnloadPointPress}
                    >
                        <Text style={styles.unloadButtonText}>Default Point</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.bottomContainer}>
                    <ScrollView contentContainerStyle={styles.bottomContent} showsVerticalScrollIndicator={false}>
                        {errorMessage ? (
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        ) : (!selectedCheckpoint ? (
                            <Text style={styles.clickPointText}>Click on the point</Text>
                        ) : (
                            <>
                                <Text style={styles.locationTitle}>
                                    {selectedCheckpoint.checkpointName || 'Checkpoint'}
                                </Text>
                                <View style={styles.topActionsRow}>
                                    <View style={styles.recenterButton} />
                                    <View style={styles.rightButtons}>
                                        <TouchableOpacity style={styles.goButton} onPress={handleGo}>
                                            <Ionicons name="navigate" size={20} color={Colors.white} style={{marginRight: 5}}/>
                                            <Text style={styles.goButtonText}>{"Go"}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.startVisitButton} onPress={handleStartVisit}>
                                            <Text style={styles.startVisitButtonText}>Start Visit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.actionButtonsRow}>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => {
                                            navigation.navigate('EntryInstructionsPage', {
                                                menu: true,
                                                data: selectedCheckpoint,
                                                routeName
                                            });
                                        }}
                                    >
                                        <Text style={styles.actionButtonText}>Visit info</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => {
                                            navigation.navigate('ChatComponent', {menu: true});
                                        }}
                                    >
                                        <Text style={styles.actionButtonText}>Write to disp</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => { handleCallPress(selectedCheckpoint.phone) }}
                                    >
                                        <Ionicons name="call" size={16} color={Colors.blackText} style={{marginRight: 5}}/>
                                        <Text style={styles.actionButtonText}>Call to customer</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.infoCard}>
                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons
                                            name="map-marker-outline"
                                            size={20}
                                            color={Colors.mainRed}
                                            style={{marginRight: 8}}
                                        />
                                        <View>
                                            <View style={styles.iconLabel}>
                                                <Text style={styles.infoLabel}>Checkpoint Address</Text>
                                            </View>
                                            <Text style={styles.infoValue}>
                                                {selectedCheckpoint.address || '---'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <MaterialCommunityIcons
                                            name="clock-time-five-outline"
                                            size={20}
                                            color={Colors.mainRed}
                                            style={{marginRight: 8}}
                                        />
                                        <View style={styles.infoRowNext}>
                                            <View style={styles.infoColumnNext}>
                                                <Text style={styles.infoLabel}>Arrival time</Text>
                                                <Text style={styles.infoValue}>{arrivalTime || '---'}</Text>
                                            </View>
                                            <View style={styles.infoColumnNext}>
                                                <Text style={styles.infoLabel}>Hours</Text>
                                                <Text style={styles.infoValue}>
                                                    {selectedCheckpoint.hours || '---'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </>
                        ))}
                    </ScrollView>
                </View>
            </View>

            <UniversalModal
                visible={modalVisible}
                title="Are you sure you want to start a visit?"
                description="In order not to start a new route, but only to view it, you can return to the list of routes and click on 'view route'."
                confirmText="Confirm"
                cancelText="Cancel"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />

            <BottomNavigationMenu navigation={navigation} activeTab="Map"/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    mapContainer: {
        flex: 1,
    },
    bottomContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        height: 250
    },
    bottomContent: {
        padding: 20,
    },
    locationTitle: {
        fontSize: Fonts.f16,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    topActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    recenterButton: {
        backgroundColor: Colors.white,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    rightButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    goButton: {
        backgroundColor: Colors.mainBlue,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginRight: 10,
    },
    goButtonText: {
        color: Colors.white,
        fontSize: Fonts.f14,
        fontWeight: 'bold',
    },
    startVisitButton: {
        backgroundColor: Colors.white,
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: Colors.mainBlue,
    },
    startVisitButtonText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f14,
        fontWeight: 'bold',
    },
    infoCard: {
        backgroundColor: Colors.white,
        borderRadius: 8,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    infoRow: {
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    infoLabel: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: Colors.blackText + '60',
    },
    infoValue: {
        fontSize: Fonts.f12,
        color: Colors.blackText,
    },
    errorText: {
        fontSize: Fonts.f14,
        color: Colors.mainRed,
        textAlign: 'center',
    },
    clickPointText: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
        textAlign: 'center',
    },
    infoRowNext: {
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '90%',
    },
    infoColumnNext: {
        marginBottom: 10,
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginRight: 5,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.mainBlue + '20',
        paddingVertical: 20,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    actionButtonText: {
        color: Colors.blackText,
        fontSize: Fonts.f14,
        fontWeight: '500',
    },
    unloadButton: {
        backgroundColor: Colors.mainRed + '20',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        alignSelf: 'center',
        marginTop: 10,
    },
    unloadButtonText: {
        color: Colors.mainRed,
        fontSize: Fonts.f14,
        fontWeight: 'bold',
    },
});
