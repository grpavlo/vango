import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";

import BottomNavigationMenu from "../components/BottomNavigationMenu";
import GoogleMapComponent from "../components/GoogleMapComponent";
import UniversalModal from "../components/UniversalModal";
import {Colors, Fonts} from "../utils/tokens";
import {handleCallPress} from "../function/handleCallPress";
import {serverUrlApi} from "../const/api";
import {useInfoCheckpoint} from "../store/infoCheckpoint";
import {convertMetersToMiles} from "../function/convertMetersToMiles";

const GOOGLE_API_KEY = 'AIzaSyA8Gs9cDcKHTrC83D_GaBVeP2yCfA_Doxs'; // замініть на ваш дійсний ключ

const FLAG_COLOR_MAP = {
    1: '#EF4444',
    2: '#FACC15',
    3: '#34D399',
    4: Colors.mainBlue,
};

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
    const [isLoadingRoute, setIsLoadingRoute] = useState(true);
    const [showStopsList, setShowStopsList] = useState(false);

    // ID of the checkpoint user selected for start visit
    const [idCheckpoint, setIdCheckpoint] = useState(null);
    const [checkpointData, setCheckpointData] = useState(null);
    const [routeSummary, setRouteSummary] = useState({
        statusLabel: "",
        scheduleLabel: "",
        stopsLabel: "",
        distanceLabel: "",
        completedStops: 0,
        totalStops: 0,
    });

    const {setData} = useInfoCheckpoint();


    const formatDurationLabel = (durationInSeconds) => {
        if (durationInSeconds === null || durationInSeconds === undefined) {
            return "";
        }

        const totalSeconds = Number(durationInSeconds);
        if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
            return "";
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const parts = [];
        if (hours > 0) {
            parts.push(`${hours}h`);
        }
        if (minutes > 0) {
            parts.push(`${minutes}m`);
        }

        return parts.length > 0 ? parts.join(" ") : "";
    };

    const formatRouteStartTime = (startDateString) => {
        if (!startDateString) {
            return "";
        }

        const date = new Date(startDateString);
        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const buildScheduleLabel = (startLabel, durationLabel) => {
        if (!startLabel && !durationLabel) {
            return "";
        }

        if (startLabel && durationLabel) {
            return `${startLabel} · ${durationLabel}`;
        }

        return startLabel || durationLabel || "";
    };

    const statusPalette = useMemo(() => {
        if (routeSummary.statusLabel === "In Progress") {
            return {
                backgroundColor: "#E5F7ED",
                textColor: "#1EAD64",
            };
        }

        if (routeSummary.statusLabel === "Completed") {
            return {
                backgroundColor: "#E8EAF6",
                textColor: Colors.mainBlue,
            };
        }

        return {
            backgroundColor: Colors.mainBlue + '20',
            textColor: Colors.mainBlue,
        };
    }, [routeSummary.statusLabel]);

    const checkpointProgressLabel = useMemo(() => {
        if (!selectedCheckpoint || !routeSummary.totalStops) {
            return "--";
        }

        const sequenceNumber = Number(selectedCheckpoint.sequence);
        if (!Number.isFinite(sequenceNumber) || sequenceNumber <= 0) {
            return "--";
        }

        return `${sequenceNumber}/${routeSummary.totalStops}`;
    }, [selectedCheckpoint, routeSummary.totalStops]);


    // Функція форматування годин
    const formatHours = (startSeconds, endSeconds) => {
        const startNumeric = Number(startSeconds);
        const endNumeric = Number(endSeconds);

        if (!Number.isFinite(startNumeric) || !Number.isFinite(endNumeric) || (startNumeric === 0 && endNumeric === 0)) {
            return '---';
        }

        const startTimeDate = new Date(0);
        startTimeDate.setSeconds(startNumeric);
        const endTimeDate = new Date(0);
        endTimeDate.setSeconds(endNumeric);
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

    const getVisitOrder = (visit, fallbackIndex) => {
        const candidateFields = [
            'sequence',
            'sequenceNumber',
            'position',
            'order',
            'count',
        ];

        for (const field of candidateFields) {
            const value = visit?.[field];
            if (value === 0) {
                continue;
            }
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                return numeric;
            }
        }

        return fallbackIndex + 1;
    };

    const buildVisitAddress = (visit) => {
        const addressParts = [
            visit?.address,
            visit?.city,
            visit?.state,
            visit?.zipCode,
        ].filter(Boolean);

        return addressParts.join(', ');
    };

    useEffect(() => {
        const fetchRoute = async () => {
            setIsLoadingRoute(true);
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

                        const estimatedDurationLabel = formatDurationLabel(data.estimatedDuration);
                        const startTimeLabel = data.startDate ? formatRouteStartTime(data.startDate) : "";
                        const scheduleLabel = buildScheduleLabel(startTimeLabel, estimatedDurationLabel);
                        const distanceLabel = data.estimatedDistance
                            ? `${convertMetersToMiles(data.estimatedDistance)} mi`
                            : "";

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

                        const transformVisit = (visit, index, isCompleted) => {
                            if (!visit?.locationPoint) {
                                return null;
                            }

                            const hours = formatHours(visit.startTime, visit.endTime);
                            const flagColor = FLAG_COLOR_MAP[visit.flag] || null;
                            const priorityLabel = typeof visit.priority === 'string'
                                ? visit.priority
                                : visit.priority
                                    ? 'STAT'
                                    : null;

                            return {
                                ...visit,
                                latitude: visit.locationPoint.latitude,
                                longitude: visit.locationPoint.longitude,
                                id: visit.id,
                                checkpointName: visit.checkpointName,
                                address: buildVisitAddress(visit) || visit.address,
                                dropOff: visit.dropOff,
                                name: visit.checkpointName,
                                type: visit.dropOff ? 'unloading' : 'loading',
                                flagColor,
                                stat: priorityLabel,
                                hours,
                                isCompleted,
                                markerColor: isCompleted ? 'blue' : 'red',
                                color: isCompleted ? 'blue' : 'red',
                                order: getVisitOrder(visit, index),
                            };
                        };

                        const completedPointsRaw = completedVisits
                            .map((visit, index) => transformVisit(visit, index, true))
                            .filter(Boolean);
                        const upcomingPointsRaw = visits
                            .map((visit, index) => transformVisit(visit, index, false))
                            .filter(Boolean);

                        const combinedPoints = [...completedPointsRaw, ...upcomingPointsRaw];

                        const sortedWaypoints = combinedPoints
                            .slice()
                            .sort((a, b) => {
                                const orderA = Number(a.order) || 0;
                                const orderB = Number(b.order) || 0;
                                return orderA - orderB;
                            })
                            .map((point, index) => ({
                                ...point,
                                sequence: index + 1,
                            }));

                        const completedCount = sortedWaypoints.filter((point) => point.isCompleted).length;
                        const totalStops = sortedWaypoints.length;
                        const statusLabel = data.started ? (data.finished ? "Completed" : "In Progress") : "Scheduled";

                        setRouteSummary({
                            statusLabel,
                            scheduleLabel,
                            stopsLabel: totalStops ? `${completedCount}/${totalStops} stops` : "",
                            distanceLabel,
                            completedStops: completedCount,
                            totalStops,
                        });

                        setWaypoints(sortedWaypoints);
                        const defaultCheckpoint = sortedWaypoints.find((point) => !point.isCompleted) || sortedWaypoints[sortedWaypoints.length - 1] || null;
                        setSelectedCheckpoint(defaultCheckpoint);
                        setShowStopsList(false);

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
            } finally {
                setIsLoadingRoute(false);
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

    const handleSelectCheckpoint = useCallback((checkpoint) => {
        if (!checkpoint) {
            return;
        }
        setSelectedCheckpoint(checkpoint);
        setShowStopsList(false);
    }, []);

    const handleGo = () => {
        setData(selectedCheckpoint);

        navigation.navigate('CheckpointViewPage', {
            idCheckpoint: selectedCheckpoint.id,
            data:selectedCheckpoint,
            routeName,
            idRoute
        });
    };

    const handleStopsPress = () => {
        if (!idRoute) return;
        setShowStopsList((prev) => !prev);
    };

    const handleStopsManage = () => {
        if (!idRoute) return;
        setShowStopsList(false);
        navigation.navigate('RouteCheckpointsPageSelect', {idRoute: Number(idRoute)});
    };

    // Натискання на маркер (звичайні точки)
    const handleMarkerPress = (waypoint) => {
        handleSelectCheckpoint(waypoint);
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

    const hasPhone = Boolean(selectedCheckpoint?.phone);

    return (
        <View style={styles.screen}>
            <View style={styles.mapWrapper}>
                {(key && origin) ? (
                    <GoogleMapComponent
                        key={key}
                        keyMap={key}
                        origin={origin}
                        waypoints={waypoints}
                        encodedRoute={encodedRoute}
                        onMapReady={() => console.log('Map is ready')}
                        onMarkerPress={handleMarkerPress}
                        navigator={navigator}
                        unloadPoint={unloadPoint}
                        selectedCheckpointId={selectedCheckpoint?.id}
                    />
                ) : null}

                <View style={styles.topOverlay}>
                    <View style={styles.headerCard}>
                        <View style={styles.headerRow}>
                            {routeSummary.statusLabel ? (
                                <View style={[styles.statusChip, {backgroundColor: statusPalette.backgroundColor}]}> 
                                    <Text style={[styles.statusChipText, {color: statusPalette.textColor}]}> 
                                        {routeSummary.statusLabel}
                                    </Text>
                                </View>
                            ) : null}
                            <TouchableOpacity
                                style={[
                                    styles.stopsButton,
                                    showStopsList && styles.stopsButtonActive,
                                    !idRoute && styles.stopsButtonDisabled,
                                ]}
                                onPress={handleStopsPress}
                                disabled={!idRoute}
                            >
                                <Ionicons
                                    name={showStopsList ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={showStopsList ? Colors.white : Colors.mainBlue}
                                    style={styles.stopsButtonIcon}
                                />
                                <Text style={[styles.stopsButtonText, showStopsList && styles.stopsButtonTextActive]}>Stops</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.routeTitle} numberOfLines={1}>{routeName || 'Route overview'}</Text>
                        <View style={styles.routeMetaRow}>
                            {routeSummary.scheduleLabel ? (
                                <Text style={styles.routeMetaText}>{routeSummary.scheduleLabel}</Text>
                            ) : null}
                            {routeSummary.scheduleLabel && (routeSummary.stopsLabel || routeSummary.distanceLabel) ? (
                                <View style={styles.routeMetaDivider} />
                            ) : null}
                            {routeSummary.stopsLabel ? (
                                <Text style={styles.routeMetaText}>{routeSummary.stopsLabel}</Text>
                            ) : null}
                            {routeSummary.stopsLabel && routeSummary.distanceLabel ? (
                                <View style={styles.routeMetaDivider} />
                            ) : null}
                            {routeSummary.distanceLabel ? (
                                <Text style={styles.routeMetaText}>{routeSummary.distanceLabel}</Text>
                            ) : null}
                        </View>
                    </View>
                </View>

                {showStopsList && waypoints.length > 0 && (
                    <View style={styles.stopsListWrapper}>
                        <View style={styles.stopsListCard}>
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.stopsListContent}
                            >
                                {waypoints.map((checkpoint) => {
                                    const isSelected = selectedCheckpoint?.id === checkpoint.id;
                                    const flagColor = checkpoint.flagColor;
                                    const hasStat = Boolean(checkpoint.stat);
                                    const displayName = checkpoint.stat && typeof checkpoint.checkpointName === 'string'
                                        ? checkpoint.checkpointName.replace(/^STAT\s+/i, '')
                                        : checkpoint.checkpointName;

                                    return (
                                        <TouchableOpacity
                                            key={checkpoint.id || checkpoint.sequence}
                                            style={[styles.stopListItem, isSelected && styles.stopListItemActive]}
                                            onPress={() => handleSelectCheckpoint(checkpoint)}
                                        >
                                            <View style={[styles.stopListIcon, checkpoint.isCompleted ? styles.stopListIconCompleted : styles.stopListIconUpcoming]}>
                                                <Ionicons
                                                    name={checkpoint.dropOff ? 'arrow-down' : 'arrow-up'}
                                                    size={14}
                                                    color={checkpoint.isCompleted ? Colors.white : Colors.mainBlue}
                                                />
                                            </View>
                                            <View style={styles.stopListDetails}>
                                                <View style={styles.stopListTitleRow}>
                                                    <Text style={styles.stopListTitle} numberOfLines={1}>
                                                        {checkpoint.sequence}. {displayName || 'Checkpoint'}
                                                    </Text>
                                                    {hasStat && (
                                                        <View style={styles.stopListStatChip}>
                                                            <Text style={styles.stopListStatText}>{checkpoint.stat}</Text>
                                                        </View>
                                                    )}
                                                    {flagColor ? (
                                                        <MaterialCommunityIcons
                                                            name="flag-variant"
                                                            size={14}
                                                            color={flagColor}
                                                            style={styles.stopListFlagIcon}
                                                        />
                                                    ) : null}
                                                </View>
                                                {checkpoint.address ? (
                                                    <Text style={styles.stopListSubtitle} numberOfLines={1}>
                                                        {checkpoint.address}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <View style={styles.stopListStatusIcon}>
                                                {checkpoint.isCompleted ? (
                                                    <Ionicons name="checkmark-circle" size={18} color={Colors.mainBlue} />
                                                ) : (
                                                    <Ionicons name="ellipse-outline" size={18} color={Colors.blackText + '40'} />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            <TouchableOpacity style={styles.manageStopsButton} onPress={handleStopsManage}>
                                <Text style={styles.manageStopsText}>Manage stops</Text>
                                <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.mainBlue} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {unloadPoint && !showStopsList && (
                    <TouchableOpacity style={styles.unloadFloatingButton} onPress={handleUnloadPointPress}>
                        <MaterialCommunityIcons name="arrow-bottom-left" size={18} color={Colors.mainRed} style={styles.unloadFloatingIcon} />
                        <Text style={styles.unloadFloatingText}>Default point</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.bottomOverlay}>
                    <View style={styles.bottomSheet}>
                        {isLoadingRoute ? (
                            <View style={styles.centerContent}>
                                <Text style={styles.mutedText}>Loading route details...</Text>
                            </View>
                        ) : errorMessage ? (
                            <ScrollView contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </ScrollView>
                        ) : !selectedCheckpoint ? (
                            <View style={styles.centerContent}>
                                <Text style={styles.mutedText}>Tap a stop on the map to view details.</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={styles.sheetScrollContent} showsVerticalScrollIndicator={false}>
                                <View style={styles.sheetHeader}>
                                    <View style={styles.sheetHeaderBadges}>
                                        <Text style={styles.checkpointTypeLabel}>{selectedCheckpoint.dropOff ? 'Drop-off' : 'Pick-up'}</Text>
                                        {selectedCheckpoint.stat ? (
                                            <View style={styles.statChip}>
                                                <Text style={styles.statChipText}>{selectedCheckpoint.stat}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={styles.checkpointTitle} numberOfLines={2}>
                                        {selectedCheckpoint.checkpointName || 'Checkpoint'}
                                    </Text>
                                    {selectedCheckpoint.address ? (
                                        <Text style={styles.checkpointAddress} numberOfLines={2}>
                                            {selectedCheckpoint.address}
                                        </Text>
                                    ) : null}
                                </View>

                                <View style={styles.infoRowGroup}>
                                    <View style={[styles.infoItemWide, styles.infoItemWideSpacer]}>
                                        <MaterialCommunityIcons
                                            name="clock-time-five-outline"
                                            size={20}
                                            color={Colors.mainBlue}
                                            style={styles.infoIcon}
                                        />
                                        <View>
                                            <Text style={styles.infoLabel}>Arrival time</Text>
                                            <Text style={styles.infoValue}>{arrivalTime || '---'}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.infoItemWide, styles.infoItemWideLast]}>
                                        <MaterialCommunityIcons
                                            name="calendar-clock"
                                            size={20}
                                            color={Colors.mainBlue}
                                            style={styles.infoIcon}
                                        />
                                        <View>
                                            <Text style={styles.infoLabel}>Hours</Text>
                                            <Text style={styles.infoValue}>{selectedCheckpoint.hours || '---'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.infoRowGroup}>
                                    <View style={[styles.infoItemWide, styles.infoItemWideSpacer]}>
                                        <MaterialCommunityIcons
                                            name="map-marker-outline"
                                            size={20}
                                            color={Colors.mainBlue}
                                            style={styles.infoIcon}
                                        />
                                        <View>
                                            <Text style={styles.infoLabel}>Stop number</Text>
                                            <Text style={styles.infoValue}>{checkpointProgressLabel}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.infoItemWide, styles.infoItemWideLast]}>
                                        <MaterialCommunityIcons
                                            name="phone-outline"
                                            size={20}
                                            color={Colors.mainBlue}
                                            style={styles.infoIcon}
                                        />
                                        <View>
                                            <Text style={styles.infoLabel}>Contact</Text>
                                            <Text style={styles.infoValue}>{selectedCheckpoint.phone || '---'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.primaryActionsRow}>
                                    <TouchableOpacity style={styles.primaryActionButton} onPress={handleGo}>
                                        <Ionicons name="navigate" size={20} color={Colors.white} style={styles.primaryActionIcon} />
                                        <Text style={styles.primaryActionText}>Navigate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.secondaryActionButton} onPress={handleStartVisit}>
                                        <Text style={styles.secondaryActionText}>Start Visit</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.quickActionsRow}>
                                    <TouchableOpacity
                                        style={[styles.quickActionButton, styles.quickActionButtonSpacer]}
                                        onPress={() => {
                                            navigation.navigate('EntryInstructionsPage', {
                                                menu: true,
                                                data: selectedCheckpoint,
                                                routeName,
                                            });
                                        }}
                                    >
                                        <Ionicons name="information-circle-outline" size={18} color={Colors.mainBlue} style={styles.quickActionIcon} />
                                        <Text style={styles.quickActionText}>Visit info</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickActionButton, styles.quickActionButtonSpacer]}
                                        onPress={() => navigation.navigate('ChatComponent', {menu: true})}
                                    >
                                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.mainBlue} style={styles.quickActionIcon} />
                                        <Text style={styles.quickActionText}>Write to disp</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickActionButton, !hasPhone && styles.quickActionButtonDisabled]}
                                        onPress={() => hasPhone && handleCallPress(selectedCheckpoint.phone)}
                                        disabled={!hasPhone}
                                    >
                                        <Ionicons name="call" size={18} color={Colors.mainBlue} style={styles.quickActionIcon} />
                                        <Text style={styles.quickActionText}>Call customer</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}
                    </View>
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
    screen: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    mapWrapper: {
        flex: 1,
        position: 'relative',
        backgroundColor: Colors.white,
    },
    topOverlay: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
    },
    headerCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 18,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statusChip: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusChipText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.mainBlue,
    },
    stopsButtonActive: {
        backgroundColor: Colors.mainBlue,
    },
    stopsButtonDisabled: {
        borderColor: Colors.lightGray,
        opacity: 0.6,
    },
    stopsButtonIcon: {
        marginRight: 6,
    },
    stopsButtonText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsButtonTextActive: {
        color: Colors.white,
    },
    routeTitle: {
        fontSize: Fonts.f18,
        fontWeight: '700',
        color: Colors.blackText,
        marginBottom: 6,
    },
    routeMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    routeMetaText: {
        fontSize: Fonts.f12,
        color: Colors.blackText + '99',
        marginRight: 8,
        marginBottom: 4,
    },
    routeMetaDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.lightGray,
        marginRight: 8,
        marginBottom: 4,
    },
    unloadFloatingButton: {
        position: 'absolute',
        top: 120,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    unloadFloatingIcon: {
        marginRight: 6,
    },
    unloadFloatingText: {
        color: Colors.mainRed,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsListWrapper: {
        position: 'absolute',
        top: 140,
        left: 16,
        right: 16,
    },
    stopsListCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        maxHeight: 280,
        overflow: 'hidden',
    },
    stopsListContent: {
        paddingVertical: 8,
    },
    stopListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    stopListItemActive: {
        backgroundColor: Colors.mainBlue + '15',
    },
    stopListIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stopListIconCompleted: {
        backgroundColor: Colors.mainBlue,
    },
    stopListIconUpcoming: {
        backgroundColor: Colors.mainBlue + '12',
    },
    stopListDetails: {
        flex: 1,
        minWidth: 0,
    },
    stopListTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 2,
    },
    stopListTitle: {
        fontSize: Fonts.f14,
        fontWeight: '600',
        color: Colors.blackText,
        marginRight: 6,
    },
    stopListStatChip: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: 6,
    },
    stopListStatText: {
        color: Colors.mainRed,
        fontSize: Fonts.f10,
        fontWeight: '700',
    },
    stopListFlagIcon: {
        marginLeft: 4,
    },
    stopListSubtitle: {
        fontSize: Fonts.f12,
        color: Colors.blackText + '70',
    },
    stopListStatusIcon: {
        marginLeft: 12,
    },
    manageStopsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
    },
    manageStopsText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f14,
        fontWeight: '600',
    },
    bottomOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    bottomSheet: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 20,
        maxHeight: 360,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 12,
    },
    sheetScrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    centerContent: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mutedText: {
        fontSize: Fonts.f14,
        color: Colors.blackText + '60',
        textAlign: 'center',
    },
    errorText: {
        fontSize: Fonts.f14,
        color: Colors.mainRed,
        textAlign: 'center',
    },
    sheetHeader: {
        marginBottom: 16,
    },
    sheetHeaderBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    checkpointTypeLabel: {
        backgroundColor: Colors.mainBlue + '15',
        color: Colors.mainBlue,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        fontSize: Fonts.f12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginRight: 8,
    },
    statChip: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statChipText: {
        color: Colors.mainRed,
        fontSize: Fonts.f12,
        fontWeight: '700',
    },
    checkpointTitle: {
        fontSize: Fonts.f18,
        fontWeight: '700',
        color: Colors.blackText,
        marginBottom: 6,
    },
    checkpointAddress: {
        fontSize: Fonts.f14,
        color: Colors.blackText + '80',
    },
    infoRowGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    infoItemWide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.mainBlue + '08',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
    },
    infoItemWideSpacer: {
        marginRight: 12,
    },
    infoItemWideLast: {
        marginRight: 0,
    },
    infoIcon: {
        marginRight: 10,
    },
    infoLabel: {
        fontSize: Fonts.f12,
        color: Colors.blackText + '60',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
        fontWeight: '600',
    },
    primaryActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    primaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.mainBlue,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        flex: 1,
        marginRight: 12,
    },
    primaryActionIcon: {
        marginRight: 8,
    },
    primaryActionText: {
        color: Colors.white,
        fontSize: Fonts.f14,
        fontWeight: '700',
    },
    secondaryActionButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.mainBlue,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f14,
        fontWeight: '700',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.mainBlue + '0F',
        paddingVertical: 12,
        borderRadius: 16,
    },
    quickActionButtonSpacer: {
        marginRight: 12,
    },
    quickActionButtonDisabled: {
        opacity: 0.5,
    },
    quickActionIcon: {
        marginRight: 6,
    },
    quickActionText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
});
