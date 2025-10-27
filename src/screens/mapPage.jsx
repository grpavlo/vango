import {Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import {ThemeProvider, useDesignSystem} from "../context/ThemeContext";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";

import BottomNavigationMenu from "../components/BottomNavigationMenu";
import GoogleMapComponent from "../components/GoogleMapComponent";
import UniversalModal from "../components/UniversalModal";
import {Fonts} from "../utils/tokens";
import {handleCallPress} from "../function/handleCallPress";
import {serverUrlApi} from "../const/api";
import {useInfoCheckpoint} from "../store/infoCheckpoint";
import {convertMetersToMiles} from "../function/convertMetersToMiles";

const GOOGLE_API_KEY = 'AIzaSyA8Gs9cDcKHTrC83D_GaBVeP2yCfA_Doxs'; // замініть на ваш дійсний ключ

const withAlpha = (hex, alpha) => {
    if (!hex || typeof hex !== "string") {
        return hex;
    }

    const normalized = hex.replace("#", "");
    if (normalized.length !== 6) {
        return hex;
    }

    return `#${normalized}${alpha}`;
};

const createPalette = (tokens, theme) => ({
    background: tokens.background,
    cardSurface: tokens.cardBackground,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    textMuted: tokens.textMuted,
    border: tokens.border,
    mutedBackground: tokens.mutedBackground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground,
    destructive: tokens.destructive,
    overlay: theme === "dark" ? "rgba(17,17,17,0.9)" : "rgba(250,250,250,0.92)",
    cardShadow: theme === "dark" ? "rgba(0,0,0,0.35)" : tokens.navShadow,
    pickupAccent: "#2563EB",
    dropoffAccent: tokens.primary,
    statBackground: withAlpha(tokens.destructive, "1F"),
    statText: tokens.destructive,
    progressBackground: withAlpha(tokens.primary, "18"),
    progressText: tokens.primary,
});

const createFlagColorMap = (primaryColor) => ({
    1: "#EF4444",
    2: "#FACC15",
    3: "#34D399",
    4: primaryColor,
});

const MapPageContent = ({navigation}) => {
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

    const {tokens, theme, spacing, radii} = useDesignSystem();
    const palette = useMemo(
        () => createPalette(tokens, theme),
        [tokens, theme],
    );
    const flagColorMap = useMemo(
        () => createFlagColorMap(palette.primary),
        [palette.primary],
    );
    const styles = useMemo(
        () => createStyles({palette, spacing, radii, theme}),
        [palette, spacing, radii, theme],
    );


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
        if (routeSummary.statusLabel === "In Progress" || routeSummary.statusLabel === "Completed") {
            return {
                backgroundColor: withAlpha(palette.primary, "1F"),
                textColor: palette.primary,
            };
        }

        return {
            backgroundColor: withAlpha(palette.textPrimary, "14"),
            textColor: palette.textPrimary,
        };
    }, [palette, routeSummary.statusLabel]);

    const checkpointProgressLabel = useMemo(() => {
        if (!selectedCheckpoint || !routeSummary.totalStops) {
            return "";
        }

        const sequenceNumber = Number(selectedCheckpoint.sequence);
        if (!Number.isFinite(sequenceNumber) || sequenceNumber <= 0) {
            return "";
        }

        return `${sequenceNumber} of ${routeSummary.totalStops}`;
    }, [selectedCheckpoint, routeSummary.totalStops]);

    const checkpointStatusPalette = useMemo(() => {
        if (selectedCheckpoint?.isCompleted) {
            return {
                backgroundColor: withAlpha(palette.primary, "18"),
                textColor: palette.primary,
                borderColor: withAlpha(palette.primary, "40"),
            };
        }

        return {
            backgroundColor: withAlpha(palette.textPrimary, "10"),
            textColor: palette.textPrimary,
            borderColor: withAlpha(palette.textPrimary, "25"),
        };
    }, [palette.primary, palette.textPrimary, selectedCheckpoint?.isCompleted]);

    const checkpointTypeStyles = useMemo(() => {
        const isDropOff = Boolean(selectedCheckpoint?.dropOff);
        const baseColor = isDropOff ? palette.dropoffAccent : palette.pickupAccent;

        return {
            iconBackground: withAlpha(baseColor, "18"),
            iconBorder: withAlpha(baseColor, "33"),
            iconColor: baseColor,
        };
    }, [palette.dropoffAccent, palette.pickupAccent, selectedCheckpoint?.dropOff]);


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
                            const flagColor = flagColorMap[visit.flag] || null;
                            const priorityLabel = typeof visit.priority === 'string'
                                ? visit.priority
                                : visit.priority
                                    ? 'STAT'
                                    : null;
                            const phoneNumber = visit.phone
                                || visit.phoneNumber
                                || visit.contactPhone
                                || visit.contact?.phone
                                || visit.contact?.phoneNumber
                                || visit.facility?.phone
                                || visit.facility?.primaryPhone
                                || null;

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
                                phone: phoneNumber,
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
        if (!selectedCheckpoint || selectedCheckpoint.isCompleted) {
            return;
        }
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

    const handleSmartRoute = useCallback(() => {
        if (!Array.isArray(waypoints) || waypoints.length === 0) {
            Alert.alert('Smart Route', 'Add stops to your route to enable smart ordering.');
            return;
        }

        const pendingStops = waypoints.filter((point) => !point?.isCompleted);

        if (pendingStops.length === 0) {
            const lastStop = waypoints[waypoints.length - 1];
            if (lastStop) {
                handleSelectCheckpoint(lastStop);
            }
            Alert.alert('Smart Route', 'All stops are already completed. Showing the final stop.');
            return;
        }

        const nextStop = pendingStops
            .slice()
            .sort((a, b) => {
                const orderA = Number(a.sequence) || Number(a.order) || 0;
                const orderB = Number(b.sequence) || Number(b.order) || 0;
                return orderA - orderB;
            })[0];

        if (nextStop) {
            handleSelectCheckpoint(nextStop);
            Alert.alert('Smart Route', `Navigate to ${nextStop.checkpointName || 'the next stop'}.`);
        }
    }, [handleSelectCheckpoint, waypoints]);

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
    const hasPriorityFlag = Boolean(selectedCheckpoint?.flagColor);
    const showProgressBadge = Boolean(checkpointProgressLabel);
    const isCheckpointCompleted = Boolean(selectedCheckpoint?.isCompleted);

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
                        onOptimizeRoute={handleSmartRoute}
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
                                    color={showStopsList ? palette.primaryForeground : palette.primary}
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
                    <View style={styles.stopsListWrapper} pointerEvents="box-none">
                        <View style={styles.stopsListCard} pointerEvents="auto">
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
                                    const isDropOff = Boolean(checkpoint.dropOff);
                                    const baseIconColor = isDropOff ? palette.dropoffAccent : palette.pickupAccent;
                                    const iconBackgroundColor = withAlpha(baseIconColor, checkpoint.isCompleted ? '26' : '18');
                                    const iconBorderColor = withAlpha(baseIconColor, '40');
                                    const iconTint = checkpoint.isCompleted ? palette.primaryForeground : baseIconColor;

                                    return (
                                        <TouchableOpacity
                                            key={checkpoint.id || checkpoint.sequence}
                                            style={[styles.stopListItem, isSelected && styles.stopListItemActive]}
                                            onPress={() => handleSelectCheckpoint(checkpoint)}
                                        >
                                            <View
                                                style={[
                                                    styles.stopListIcon,
                                                    {
                                                        backgroundColor: iconBackgroundColor,
                                                        borderColor: iconBorderColor,
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name={checkpoint.dropOff ? 'arrow-down' : 'arrow-up'}
                                                    size={14}
                                                    color={iconTint}
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
                                                    <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
                                                ) : (
                                                    <Ionicons name="ellipse-outline" size={18} color={withAlpha(palette.textPrimary, '40')} />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            {/*
                             * The previous implementation exposed a "Manage stops" shortcut here.
                             * The refreshed Route Log Buddy design no longer surfaces this control,
                             * so we keep the logic in place but hide it from the UI per product request.
                             */}
                            {false && (
                                <TouchableOpacity style={styles.manageStopsButton} onPress={handleStopsManage}>
                                    <Text style={styles.manageStopsText}>Manage stops</Text>
                                    <MaterialCommunityIcons name="arrow-right" size={16} color={palette.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/*
                 * The "Default point" floating control is not part of the new design.
                 * We keep the wiring for potential reuse but do not display the button now.
                 */}
                {false && unloadPoint && !showStopsList && (
                    <TouchableOpacity style={styles.unloadFloatingButton} onPress={handleUnloadPointPress}>
                        <MaterialCommunityIcons name="arrow-bottom-left" size={18} color={palette.destructive} style={styles.unloadFloatingIcon} />
                        <Text style={styles.unloadFloatingText}>Default point</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.bottomOverlay} pointerEvents="box-none">
                    <View style={styles.bottomBackdrop} pointerEvents="none" />
                    <View style={styles.bottomSheetContainer} pointerEvents="box-none">
                        <View style={styles.bottomSheet} pointerEvents="auto">
                            {isLoadingRoute ? (
                                <View style={styles.centerContent}>
                                    <Text style={styles.mutedText}>Loading route details...</Text>
                                </View>
                            ) : errorMessage ? (
                                <ScrollView contentContainerStyle={styles.sheetScrollContent}
                                            showsVerticalScrollIndicator={false}>
                                    <Text style={styles.errorText}>{errorMessage}</Text>
                                </ScrollView>
                            ) : !selectedCheckpoint ? (
                                <View style={styles.centerContent}>
                                    <Text style={styles.mutedText}>Tap a stop on the map to view details.</Text>
                                </View>
                            ) : (
                                <ScrollView contentContainerStyle={styles.sheetScrollContent}
                                            showsVerticalScrollIndicator={false}>
                                    <View style={styles.sheetHeader}>
                                        <View style={styles.sheetHeaderMain}>
                                            <View style={styles.sheetHeaderContent}>
                                                <View
                                                    style={[
                                                        styles.typeIconWrapper,
                                                        {
                                                            backgroundColor: checkpointTypeStyles.iconBackground,
                                                            borderColor: checkpointTypeStyles.iconBorder,
                                                        },
                                                    ]}
                                                >
                                                    <MaterialCommunityIcons
                                                        name={selectedCheckpoint.dropOff ? 'arrow-down' : 'arrow-up'}
                                                        size={20}
                                                        color={checkpointTypeStyles.iconColor}
                                                    />
                                                </View>
                                                <View style={styles.sheetHeaderTextBlock}>
                                                    <View style={styles.sheetHeaderBadges}>
                                                        <Text
                                                            style={styles.checkpointTypeLabel}>{selectedCheckpoint.dropOff ? 'Drop-off' : 'Pick-up'}</Text>
                                                        {selectedCheckpoint.stat ? (
                                                            <View style={styles.statChip}>
                                                                <Text
                                                                    style={styles.statChipText}>{selectedCheckpoint.stat}</Text>
                                                            </View>
                                                        ) : null}
                                                        {hasPriorityFlag ? (
                                                            <View
                                                                style={[
                                                                    styles.priorityChip,
                                                                    {
                                                                        backgroundColor: `${selectedCheckpoint.flagColor}20`,
                                                                        borderColor: `${selectedCheckpoint.flagColor}40`,
                                                                    },
                                                                ]}
                                                            >
                                                                <MaterialCommunityIcons
                                                                    name="flag-variant"
                                                                    size={12}
                                                                    color={selectedCheckpoint.flagColor}
                                                                />
                                                                <Text
                                                                    style={[styles.priorityChipText, {color: selectedCheckpoint.flagColor}]}>Priority</Text>
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
                                            </View>
                                        </View>
                                        <View style={styles.sheetHeaderAside}>
                                            {showProgressBadge ? (
                                                <View style={styles.progressBadge}>
                                                    <Text
                                                        style={styles.progressBadgeText}>Stop {checkpointProgressLabel}</Text>
                                                </View>
                                            ) : null}
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    {
                                                        backgroundColor: checkpointStatusPalette.backgroundColor,
                                                        borderColor: checkpointStatusPalette.borderColor,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.statusBadgeText,
                                                        {color: checkpointStatusPalette.textColor},
                                                    ]}
                                                >
                                                    {selectedCheckpoint.isCompleted ? 'Completed' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.detailMetaRow}>
                                        <MaterialCommunityIcons
                                            name="map-marker-outline"
                                            size={20}
                                            color={palette.primary}
                                            style={styles.infoIcon}
                                        />
                                        <Text style={styles.detailMetaText} numberOfLines={2}>
                                            {selectedCheckpoint.address || '---'}
                                        </Text>
                                    </View>

                                    <View style={[styles.detailMetaRow, styles.detailMetaRowWrap]}>
                                        <View style={styles.detailMetaContent}>
                                            <MaterialCommunityIcons
                                                name="clock-time-five-outline"
                                                size={20}
                                                color={palette.primary}
                                                style={styles.infoIcon}
                                            />
                                            <Text style={styles.detailMetaText} numberOfLines={1}>
                                                {selectedCheckpoint.hours || '---'}
                                            </Text>
                                        </View>
                                        {hasPhone ? (
                                            <TouchableOpacity
                                                style={styles.inlineCallButton}
                                                onPress={() => handleCallPress(selectedCheckpoint.phone)}
                                            >
                                                <Ionicons name="call" size={16} color={palette.primary}
                                                          style={styles.inlineCallIcon}/>
                                                <Text style={styles.inlineCallText}>Call site</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    <View style={styles.primaryActionsRow}>
                                        <TouchableOpacity style={styles.primaryActionButton} onPress={handleGo}>
                                            <Ionicons name="navigate" size={20} color={palette.primaryForeground}
                                                      style={styles.primaryActionIcon}/>
                                            <Text style={styles.primaryActionText}>Navigate</Text>
                                        </TouchableOpacity>
                                        {isCheckpointCompleted ? (
                                            <View
                                                style={[styles.secondaryActionButton, styles.secondaryActionButtonDisabled]}>
                                                <Text
                                                    style={[styles.secondaryActionText, styles.secondaryActionTextDisabled]}>Visit
                                                    Complete</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity style={styles.secondaryActionButton}
                                                              onPress={handleStartVisit}>
                                                <Text style={styles.secondaryActionText}>Start Visit</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/*
                                 * Quick actions (Visit info, dispatcher chat, call) are not part of the
                                 * latest Route Log Buddy map design. They remain accessible elsewhere,
                                 * so we hide this legacy row from the refreshed layout.
                                 */}
                                    {false && (
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
                                                <Ionicons name="information-circle-outline" size={18}
                                                          color={palette.primary} style={styles.quickActionIcon}/>
                                                <Text style={styles.quickActionText}>Visit info</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.quickActionButton, styles.quickActionButtonSpacer]}
                                                onPress={() => navigation.navigate('ChatComponent', {menu: true})}
                                            >
                                                <Ionicons name="chatbubble-ellipses-outline" size={18}
                                                          color={palette.primary} style={styles.quickActionIcon}/>
                                                <Text style={styles.quickActionText}>Write to disp</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.quickActionButton, !hasPhone && styles.quickActionButtonDisabled]}
                                                onPress={() => hasPhone && handleCallPress(selectedCheckpoint.phone)}
                                                disabled={!hasPhone}
                                            >
                                                <Ionicons name="call" size={18} color={palette.primary}
                                                          style={styles.quickActionIcon}/>
                                                <Text style={styles.quickActionText}>Call customer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
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
        </View>
    );
};


const createStyles = ({palette, spacing, radii, theme}) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: palette.background,
    },
    mapWrapper: {
        flex: 1,
        position: 'relative',
        backgroundColor: palette.background,
    },
    topOverlay: {
        position: 'absolute',
        top: spacing.lg,
        left: spacing.lg,
        right: spacing.lg,
        zIndex: 20,
    },
    headerCard: {
        backgroundColor: palette.cardSurface,
        borderRadius: radii.xl,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        shadowColor: palette.cardShadow,
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
        shadowRadius: 14,
        elevation: theme === 'dark' ? 14 : 6,
        borderWidth: 1,
        borderColor: palette.border,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    statusChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    statusChipText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.cardSurface,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.primary,
    },
    stopsButtonActive: {
        backgroundColor: palette.primary,
    },
    stopsButtonDisabled: {
        borderColor: palette.border,
        opacity: 0.6,
    },
    stopsButtonIcon: {
        marginRight: 6,
    },
    stopsButtonText: {
        color: palette.primary,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsButtonTextActive: {
        color: palette.primaryForeground,
    },
    routeTitle: {
        fontSize: Fonts.f18,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: spacing.xs,
    },
    routeMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    routeMetaText: {
        fontSize: Fonts.f12,
        color: withAlpha(palette.textSecondary, 'E0'),
        marginRight: spacing.xs,
        marginBottom: 4,
    },
    routeMetaDivider: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: palette.border,
        marginRight: spacing.xs,
        marginBottom: 4,
    },
    unloadFloatingButton: {
        position: 'absolute',
        top: 120,
        right: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.cardSurface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: withAlpha(palette.primary, '33'),
        shadowColor: palette.cardShadow,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
        shadowRadius: 6,
        elevation: theme === 'dark' ? 10 : 4,
    },
    unloadFloatingIcon: {
        marginRight: 8,
    },
    unloadFloatingText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.primary,
    },
    bottomOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl + spacing.base,
        paddingTop: spacing.lg,
        zIndex: 10,
    },
    bottomBackdrop: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
        backgroundColor: withAlpha(palette.background, theme === 'dark' ? 'F2' : 'F0'),
    },
    bottomSheetContainer: {
        position: 'relative',
        width: '100%',
    },
    bottomSheet: {
        backgroundColor: palette.cardSurface,
        borderRadius: radii.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        maxHeight: 400,
        borderWidth: 1,
        borderColor: withAlpha(palette.border, 'C0'),
        shadowColor: palette.cardShadow,
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.18,
        shadowRadius: 24,
        elevation: theme === 'dark' ? 24 : 14,
        overflow: 'hidden',
        width: '100%',
    },
    sheetScrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    centerContent: {
        paddingVertical: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mutedText: {
        fontSize: Fonts.f14,
        color: withAlpha(palette.textSecondary, 'CC'),
        textAlign: 'center',
    },
    errorText: {
        fontSize: Fonts.f14,
        color: palette.destructive,
        textAlign: 'center',
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    sheetHeaderMain: {
        flex: 1,
        marginRight: spacing.sm,
    },
    sheetHeaderContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    typeIconWrapper: {
        height: 48,
        width: 48,
        borderRadius: radii.lg,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetHeaderTextBlock: {
        flex: 1,
    },
    sheetHeaderBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: spacing.sm,
        gap: spacing.xs,
    },
    checkpointTypeLabel: {
        backgroundColor: withAlpha(palette.primary, '18'),
        color: palette.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        fontSize: Fonts.f12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginRight: spacing.xs,
    },
    statChip: {
        backgroundColor: palette.statBackground,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    statChipText: {
        color: palette.statText,
        fontSize: Fonts.f12,
        fontWeight: '700',
    },
    priorityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: withAlpha(palette.primary, '40'),
        backgroundColor: withAlpha(palette.primary, '15'),
    },
    priorityChipText: {
        fontSize: Fonts.f12,
        fontWeight: '700',
        marginLeft: 6,
        color: palette.primary,
    },
    checkpointTitle: {
        fontSize: Fonts.f18,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 4,
    },
    checkpointAddress: {
        fontSize: Fonts.f14,
        color: palette.textSecondary,
    },
    sheetHeaderAside: {
        alignItems: 'flex-end',
        gap: spacing.xs,
    },
    progressBadge: {
        backgroundColor: palette.progressBackground,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    progressBadgeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.progressText,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radii.pill,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    detailMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: withAlpha(palette.mutedBackground, 'E6'),
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
        marginBottom: spacing.sm,
    },
    detailMetaRowWrap: {
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    detailMetaContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    infoIcon: {
        marginRight: spacing.sm,
        color: palette.primary,
    },
    detailMetaText: {
        flex: 1,
        fontSize: Fonts.f14,
        color: palette.textPrimary,
        fontWeight: '600',
    },
    inlineCallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: palette.cardSurface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: withAlpha(palette.primary, '45'),
    },
    inlineCallIcon: {
        marginRight: spacing.xs,
        color: palette.primary,
    },
    inlineCallText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        color: palette.primary,
    },
    primaryActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    primaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.dropoffAccent,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.xl,
        flex: 1,
        shadowColor: palette.cardShadow,
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.2,
        shadowRadius: 10,
        elevation: theme === 'dark' ? 18 : 10,
    },
    primaryActionIcon: {
        marginRight: spacing.xs,
        color: palette.primaryForeground,
    },
    primaryActionText: {
        color: palette.primaryForeground,
        fontSize: Fonts.f14,
        fontWeight: '700',
    },
    secondaryActionButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: palette.dropoffAccent,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    secondaryActionButtonDisabled: {
        borderColor: withAlpha(palette.textPrimary, '25'),
        backgroundColor: withAlpha(palette.mutedBackground, 'F2'),
    },
    secondaryActionText: {
        color: palette.dropoffAccent,
        fontSize: Fonts.f14,
        fontWeight: '700',
    },
    secondaryActionTextDisabled: {
        color: withAlpha(palette.textSecondary, 'AA'),
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
        backgroundColor: withAlpha(palette.primary, '12'),
        paddingVertical: spacing.sm,
        borderRadius: radii.lg,
    },
    quickActionButtonSpacer: {
        marginRight: spacing.sm,
    },
    quickActionButtonDisabled: {
        opacity: 0.5,
    },
    quickActionIcon: {
        marginRight: spacing.xs,
        color: palette.primary,
    },
    quickActionText: {
        color: palette.primary,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    stopsListWrapper: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        top: spacing.lg + 120,
        zIndex: 25,
    },
    stopsListCard: {
        backgroundColor: palette.cardSurface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: 'hidden',
        shadowColor: palette.cardShadow,
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: theme === 'dark' ? 0.35 : 0.18,
        shadowRadius: 16,
        elevation: theme === 'dark' ? 18 : 10,
        maxHeight: 280,
    },
    stopsListContent: {
        paddingVertical: spacing.xs,
    },
    stopListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    stopListItemActive: {
        backgroundColor: withAlpha(palette.primary, '12'),
    },
    stopListIcon: {
        height: 32,
        width: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
        borderWidth: 1,
    },
    stopListDetails: {
        flex: 1,
    },
    stopListTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: 2,
    },
    stopListTitle: {
        flex: 1,
        fontSize: Fonts.f14,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    stopListStatChip: {
        backgroundColor: palette.statBackground,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
    },
    stopListStatText: {
        fontSize: Fonts.f10,
        fontWeight: '700',
        color: palette.statText,
    },
    stopListFlagIcon: {
        marginLeft: spacing.xs,
    },
    stopListSubtitle: {
        fontSize: Fonts.f12,
        color: palette.textSecondary,
    },
    stopListStatusIcon: {
        marginLeft: spacing.sm,
    },
    manageStopsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    manageStopsText: {
        color: palette.primary,
        fontSize: Fonts.f14,
        fontWeight: '600',
    },
});

const MapPage = (props) => (
    <ThemeProvider>
        <MapPageContent {...props} />
    </ThemeProvider>
);

export default MapPage;

