import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import ArrivalCheckPage from './ArrivalCheckPage';
import ArrivalHelpPage from './ArrivalHelpPage';
import PickUpSamplesPage from './PickUpSamplesPage';
import GoogleMapComponent from '../components/GoogleMapComponent';
import { Fonts } from '../utils/tokens';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { handleCallPress } from '../function/handleCallPress';
import { useInfoCheckpoint } from '../store/infoCheckpoint';
import { serverUrlApi } from '../const/api';
import { WebView } from 'react-native-webview';
import { useAppAlert } from '../hooks/useAppAlert';

const GOOGLE_API_KEY = 'AIzaSyA8Gs9cDcKHTrC83D_GaBVeP2yCfA_Doxs';

const floatToBytes = (float) => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, float, true);
    return new Uint8Array(buffer);
};

const int64ToBytes = (num) => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigInt64(0, BigInt(num), true);
    return new Uint8Array(buffer);
};

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

const encodePointsToBase64 = (pointsArray) => {
    if (!pointsArray || pointsArray.length === 0) return '';
    let binaryArray = [];
    pointsArray.forEach((point) => {
        binaryArray = binaryArray.concat(Array.from(floatToBytes(point.latitude)));
        binaryArray = binaryArray.concat(Array.from(floatToBytes(point.longitude)));
        binaryArray = binaryArray.concat(Array.from(int64ToBytes(point.timestamp)));
    });
    const arrayBuffer = new Uint8Array(binaryArray).buffer;
    return arrayBufferToBase64(arrayBuffer);
};

let backgroundPoints = [];
let lastSentTime = 0;

const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TRACKING';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('Background location task error:', error);
        return;
    }

    if (!data) {
        return;
    }

    const { locations } = data;
    locations.forEach((location) => {
        backgroundPoints.push({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: Date.now(),
        });
    });

    const now = Date.now();
    const savedLastSentTime = await SecureStore.getItemAsync('savedLastSentTime');
    const lastTime = savedLastSentTime ? Number(savedLastSentTime) : lastSentTime;

    if (now - lastTime >= 15000 || backgroundPoints.length >= 5) {
        await sendPointsInBackground(backgroundPoints);
        backgroundPoints = [];
        lastSentTime = now;
        await SecureStore.setItemAsync('savedLastSentTime', String(now));
    }
});

const sendPointsInBackground = async (pointsArray) => {
    if (!pointsArray.length) {
        return;
    }
    try {
        const routeId = await SecureStore.getItemAsync('idRoute');
        const accessToken = await SecureStore.getItemAsync('accessToken');
        if (!routeId || !accessToken) {
            console.log('Missing routeId or accessToken');
            return;
        }
        const base64StringEncoded = encodePointsToBase64(pointsArray);
        const response = await fetch(serverUrlApi + 'locations', {
            method: 'POST',
            headers: {
                accept: '*/*',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                routeId,
                rawData: base64StringEncoded,
            }),
        });
        if (!response.ok) {
            console.log('Failed to send background location data:', response.statusText);
        } else {
            console.log('Background location data sent successfully.');
        }
    } catch (err) {
        console.log('Error sending background location data:', err);
    }
};

const toRad = (value) => (value * Math.PI) / 180;

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toTimeLabel = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        const base = new Date(0);
        base.setSeconds(value);
        return base.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
            return toTimeLabel(numeric);
        }
        return value;
    }

    return null;
};

const formatTimeRange = (start, end, fallback = null) => {
    const startLabel = toTimeLabel(start);
    const endLabel = toTimeLabel(end);
    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }
    return startLabel || endLabel || (fallback ? String(fallback) : null);
};

const joinParts = (parts, separator = ', ') => parts.filter(Boolean).join(separator);

const INFO_PREVIEW_HEIGHT = 140;

function QuickActionButton({ icon, label, onPress, disabled, styles, palette }) {
    return (
        <TouchableOpacity
            style={[styles.quickActionButton, disabled && styles.quickActionButtonDisabled]}
            activeOpacity={disabled ? 1 : 0.85}
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
        >
            <View style={[styles.quickActionIcon, disabled && styles.quickActionIconDisabled]}>
                <Ionicons
                    name={icon}
                    size={18}
                    color={disabled ? palette.blackText + '40' : palette.mainBlue}
                />
            </View>
            <Text style={[styles.quickActionLabel, disabled && styles.quickActionLabelDisabled]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const CheckpointViewPageContent = ({ navigation, route }) => {
    const { tokens } = useDesignSystem();
    const { showAlert } = useAppAlert();
    const palette = useMemo(() => createCheckpointViewColors(tokens), [tokens]);
    const styles = useMemo(
        () => createCheckpointViewStyles(palette),
        [palette],
    );
    const {
        last,
        idCheckpoint,
        routeName = '',
        idRoute,
        startDate = null,
        openMap = false,
        canStartVisit: canStartVisitParam = true,
        canNavigate: canNavigateParam,
        showArrival = false,
        showPickUp = false,
        showHelp = false,
        dispatchPhone: routeDispatchPhone = null,
        officePhone: routeOfficePhone = null,
    } = route.params || { last: false };

    const data = useInfoCheckpoint((state) => state.data);

    const dispatchPhone = useMemo(
        () =>
            routeDispatchPhone ||
            data?.dispatchPhone ||
            data?.phone ||
            data?.contactPhone ||
            null,
        [data, routeDispatchPhone],
    );

    const officePhone = useMemo(
        () =>
            routeOfficePhone ||
            data?.officePhone ||
            data?.contactOfficePhone ||
            data?.officeContact ||
            dispatchPhone,
        [data, dispatchPhone, routeOfficePhone],
    );


    if (showPickUp) {
        return (
            <PickUpSamplesPage
                navigation={navigation}
                route={{
                    params: {
                        idRoute,
                        idCheckpoint,
                        routeName,
                        dispatchPhone,
                        officePhone,
                    },
                }}
            />
        );
    }
    if (showHelp) {
        return (
            <ArrivalHelpPage
                navigation={navigation}
                route={{
                    params: {
                        idRoute,
                        dispatchPhone,
                        officePhone,
                    },
                }}
            />
        );
    }
    if (showArrival) {
        return (
            <ArrivalCheckPage
                navigation={navigation}
                route={{
                    params: {
                        idCheckpoint,
                        idRoute,
                        routeName,
                        last,
                        isDropOff: Boolean(data?.dropOff),
                        isDefaultUnload: Boolean(data?.isDefaultUnload),
                    },
                }}
            />
        );
    }

    const [encodedRoute, setEncodedRoute] = useState('');
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isStartingVisit, setIsStartingVisit] = useState(false);
    const [key, setKey] = useState(null);
    const [navigatorActive, setNavigatorActive] = useState(false);
    const [arrivalTime, setArrivalTime] = useState(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [infoExpanded, setInfoExpanded] = useState(false);
    const [infoContentHeight, setInfoContentHeight] = useState(INFO_PREVIEW_HEIGHT);
    const [mapPrefetched, setMapPrefetched] = useState(false);

    const lastUserLocationRef = useRef(null);
    const lastCheckpointRef = useRef(null);
    const cachedEncodedRouteRef = useRef('');
    const pendingNavigationRef = useRef(false);

    const canStartVisit = Boolean(canStartVisitParam);
    const canNavigate =
        canNavigateParam === undefined ? canStartVisit : Boolean(canNavigateParam);

    const derivedAddress = useMemo(() => {
        if (data?.address) {
            return data.address;
        }
        return joinParts(
            [data?.street, data?.city, data?.state, data?.zipCode],
            ', ',
        );
    }, [data]);

    const scheduleLabel = useMemo(() => (
        data?.hours ||
        formatTimeRange(data?.startTime, data?.endTime) ||
        startDate ||
        null
    ), [data, startDate]);

    const visitInfoHtml = useMemo(() => {
        if (!data) {
            return null;
        }

        const raw =
            data.visitInformationHtml ??
            data.visitInformation ??
            data.visitInfoHtml ??
            data.visitInfo ??
            data.informationHtml ??
            data.information ??
            data.descriptionHtml ??
            data.description ??
            null;

        if (!raw || typeof raw !== 'string') {
            return null;
        }

        const escapeHtml = (value) =>
            value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

        const wrapWithDocument = (bodyContent) => `
            <html>
                <head>
                    <style>
                        body {
                            margin: 0;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            font-size: 14px;
                            color: #1F2937;
                            background-color: transparent;
                            line-height: 1.5;
                        }
                        p { margin: 0 0 8px; }
                        ul { margin: 0 0 12px 16px; padding: 0; }
                        li { margin-bottom: 6px; }
                    </style>
                </head>
                <body>${bodyContent}</body>
            </html>
        `;

        const containsHtmlTag = /<\/?[a-z][\s\S]*>/i.test(raw);

        if (containsHtmlTag) {
            if (/<html[\s>]/i.test(raw)) {
                return raw;
            }
            return wrapWithDocument(raw);
        }

        const escaped = escapeHtml(raw).replace(/\r?\n/g, '<br/>');
        return wrapWithDocument(`<div>${escaped}</div>`);
    }, [data]);

    const visitInfoItems = useMemo(() => {
        const items = [];
        const typeValue = data?.typeName || data?.type || data?.visitType;
        if (typeValue) {
            items.push({ label: 'Type', value: typeValue });
        }
        const priorityValue =
            data?.priorityLabel ||
            (typeof data?.priority === 'string' && data.priority.trim().length > 0
                ? data.priority
                : data?.priority
                ? 'STAT'
                : null);
        if (priorityValue) {
            items.push({ label: 'Priority', value: priorityValue });
        }
        const instructions = data?.specialInstructions || data?.instructions || data?.notes;
        if (instructions) {
            items.push({ label: 'Special instructions', value: instructions });
        }
        const contactLine = joinParts(
            [data?.contactName, data?.contactPhone],
            ' - ',
        );
        if (contactLine) {
            items.push({ label: 'Contact', value: contactLine });
        }
        if (data?.expectedSamples) {
            items.push({ label: 'Expected samples', value: data.expectedSamples });
        }
        return items;
    }, [data]);

    const visitScheduleItems = useMemo(() => {
        const items = [];
        const regular = data?.hours || formatTimeRange(data?.startTime, data?.endTime);
        if (regular) {
            items.push({ label: 'Regular hours', value: regular });
        }
        const lunchBreak =
            data?.lunchBreak ||
            formatTimeRange(data?.lunchBreakStart, data?.lunchBreakEnd);
        if (lunchBreak) {
            items.push({ label: 'Lunch break', value: lunchBreak });
        }
        const bestPickup =
            data?.bestPickup ||
            formatTimeRange(data?.bestPickupStart, data?.bestPickupEnd);
        if (bestPickup) {
            items.push({ label: 'Best pickup time', value: bestPickup });
        }
        if (data?.weekendAvailability) {
            items.push({ label: 'Weekend availability', value: data.weekendAvailability });
        }
        const lastPickup =
            data?.lastPickupTime ||
            formatTimeRange(data?.lastPickupStart, data?.lastPickupEnd);
        if (lastPickup) {
            items.push({ label: 'Last pickup', value: lastPickup });
        }
        if (arrivalTime) {
            items.unshift({ label: 'Estimated arrival', value: arrivalTime });
        }
        return items;
    }, [data, arrivalTime]);

    const resolveDestinationPoint = () => {
        if (destination?.latitude && destination?.longitude) {
            return destination;
        }
        const point = data?.locationPoint;
        if (
            point &&
            typeof point.latitude === 'number' &&
            typeof point.longitude === 'number'
        ) {
            return {
                latitude: point.latitude,
                longitude: point.longitude,
            };
        }
        return null;
    };

    useEffect(() => {
        setInfoExpanded(false);
        setInfoContentHeight(INFO_PREVIEW_HEIGHT);
    }, [visitInfoHtml]);

    const stopBackgroundLocationTracking = async () => {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(
            BACKGROUND_LOCATION_TASK,
        );
        if (isRunning) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            if (backgroundPoints.length > 0) {
                await sendPointsInBackground(backgroundPoints);
                backgroundPoints = [];
            }
            console.log('Background location tracking stopped.');
        }
    };

    const startBackgroundLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMessage('Location permission not granted.');
                return;
            }
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                setErrorMessage('Background location permission not granted.');
                return;
            }

            const savedTime = await SecureStore.getItemAsync('timeInterval');
            const savedDistance = await SecureStore.getItemAsync('distanceInterval');
            const time = savedTime ? parseInt(savedTime, 10) : 5000;
            const dist = savedDistance ? parseInt(savedDistance, 10) : 10;

            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy: Location.Accuracy.Highest,
                timeInterval: time,
                distanceInterval: dist,
            });
            console.log('Background location tracking started.');
        } catch (err) {
            console.error('Error starting background location tracking:', err);
        }
    };

    const fetchRouteFromGoogle = async (userLat, userLng, checkpointLat, checkpointLng) => {
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${userLat},${userLng}&destination=${checkpointLat},${checkpointLng}&key=${GOOGLE_API_KEY}&mode=driving`,
            );
            const result = await response.json();
            if (result.status === 'OK') {
                const points = result.routes?.[0]?.overview_polyline?.points;
                const leg = result.routes?.[0]?.legs?.[0];
                if (points) {
                    setEncodedRoute(points);
                    cachedEncodedRouteRef.current = points;
                }
                if (leg?.duration?.value) {
                    const eta = new Date();
                    eta.setSeconds(eta.getSeconds() + leg.duration.value);
                    setArrivalTime(
                        eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                    );
                } else {
                    setArrivalTime(null);
                }
            } else {
                //setErrorMessage('No route found.');
            }
        } catch (error) {
            setErrorMessage('Error fetching route. Please try again.');
        }
    };

    const startVisit = async () => {
        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                setErrorMessage('Authentication token is missing. Please log in again.');
                return false;
            }

            if (!startDate) {
                const response = await fetch(`${serverUrlApi}visits/${idCheckpoint}/start`, {
                    method: 'PATCH',
                    headers: {
                        accept: '*/*',
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(idCheckpoint),
                });

                if (!response.ok) {
                    setErrorMessage('Failed to start the visit. Please try again.');
                    return false;
                }
            }

            return true;
        } catch (error) {
            setErrorMessage('An error occurred while starting the visit. Please try again.');
            return false;
        }
    };

    const navigationTarget = useMemo(
        () => resolveDestinationPoint(),
        [destination, data?.locationPoint?.latitude, data?.locationPoint?.longitude],
    );

    const isNavigationEnabled = canNavigate && Boolean(navigationTarget);

    const openNavigation = async (lat, lon) => {
        const schemeUrl = Platform.select({
            ios: `maps:0,0?q=${lat},${lon}`,
            android: `geo:${lat},${lon}?q=${lat},${lon}`,
            default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        });

        try {
            const canOpen = await Linking.canOpenURL(schemeUrl);
            if (canOpen) {
                await Linking.openURL(schemeUrl);
                return true;
            }
            const fallback = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            await Linking.openURL(fallback);
            return true;
        } catch (error) {
            showAlert({
                title: 'Navigation Unavailable',
                message: 'Unable to open maps on this device.',
                variant: 'error',
            });
            return false;
        }
    };

    const handleNavigatePress = async () => {
        if (!canNavigate) {
            return;
        }

        const point = navigationTarget;
        if (!point) {
            showAlert({
                title: 'Navigation Unavailable',
                message: 'Location details are missing for this checkpoint.',
                variant: 'warning',
            });
            return;
        }

        const launched = await openNavigation(point.latitude, point.longitude);
        if (launched) {
            pendingNavigationRef.current = false;
        }
    };

    const handleStartVisitPress = async () => {
        if (!canStartVisit || isStartingVisit) {
            return;
        }

        setIsStartingVisit(true);
        const started = await startVisit();
        if (started) {
            navigation.push('CheckpointViewPage', {
                last,
                idCheckpoint,
                routeName,
                idRoute,
                startDate,
                canStartVisit: true,
                canNavigate,
                showArrival: true,
            });
        }
        setIsStartingVisit(false);
    };

    const infoInjectedScript = `
        (function() {
            function sendHeight() {
                var body = document.body;
                var html = document.documentElement;
                var height = Math.max(
                    body.scrollHeight,
                    body.offsetHeight,
                    html.clientHeight,
                    html.scrollHeight,
                    html.offsetHeight
                );
                window.ReactNativeWebView.postMessage(height.toString());
            }
            sendHeight();
            window.addEventListener('load', sendHeight);
            window.addEventListener('resize', sendHeight);
            setTimeout(sendHeight, 300);
        })();
        true;
    `;

    const handleInfoToggle = () => {
        if (!visitInfoHtml) {
            return;
        }
        setInfoExpanded((prev) => !prev);
    };

    const handleInfoWebViewMessage = (event) => {
        const nextHeight = Number(event.nativeEvent.data);
        if (!Number.isNaN(nextHeight) && nextHeight > 0) {
            setInfoContentHeight(Math.max(nextHeight, INFO_PREVIEW_HEIGHT));
        }
    };

    const infoCardHeight = infoExpanded ? infoContentHeight : INFO_PREVIEW_HEIGHT;

    useEffect(() => {
        let isMounted = true;

        const loadMapData = async () => {
            if (isMounted) {
                setLoading(true);
                setErrorMessage(null);
            }

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (isMounted) {
                        setErrorMessage('Location permission not granted.');
                    }
                    return;
                }

                const userLocation = await Location.getCurrentPositionAsync({});
                const userLat = userLocation.coords.latitude;
                const userLng = userLocation.coords.longitude;

                if (
                    !data?.locationPoint ||
                    !data?.locationPoint.latitude ||
                    !data?.locationPoint.longitude
                ) {
                    if (isMounted) {
                        setErrorMessage('Invalid checkpoint location data.');
                    }
                    return;
                }

                const checkpointLat = data.locationPoint.latitude;
                const checkpointLng = data.locationPoint.longitude;

                if (isMounted) {
                    setOrigin({ latitude: userLat, longitude: userLng });
                    setDestination({ latitude: checkpointLat, longitude: checkpointLng });
                }

                const lastUserLocation = lastUserLocationRef.current;
                const lastCheckpoint = lastCheckpointRef.current;
                const userDistance = lastUserLocation
                    ? getDistanceInMeters(
                          userLat,
                          userLng,
                          lastUserLocation.lat,
                          lastUserLocation.lng,
                      )
                    : Infinity;
                const sameCheckpoint =
                    lastCheckpoint &&
                    lastCheckpoint.lat === checkpointLat &&
                    lastCheckpoint.lng === checkpointLng;

                const movementThreshold = 50;
                if (
                    userDistance < movementThreshold &&
                    sameCheckpoint &&
                    cachedEncodedRouteRef.current
                ) {
                    if (isMounted) {
                        setEncodedRoute(cachedEncodedRouteRef.current);
                    }
                } else {
                    await fetchRouteFromGoogle(userLat, userLng, checkpointLat, checkpointLng);
                    lastUserLocationRef.current = { lat: userLat, lng: userLng };
                    lastCheckpointRef.current = { lat: checkpointLat, lng: checkpointLng };
                }

                if (isMounted) {
                    setMapPrefetched(true);
                }
            } catch (error) {
                if (isMounted) {
                    setErrorMessage('Could not retrieve location. Please try again.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (isMapExpanded || (canNavigate && !mapPrefetched)) {
            loadMapData();
        } else {
            setLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [data, isMapExpanded, mapPrefetched, canNavigate]);

    useEffect(() => {
        if (!isMapExpanded) {
            pendingNavigationRef.current = false;
        }
    }, [isMapExpanded]);

    useEffect(() => {
        if (!isMapExpanded && navigatorActive) {
            setNavigatorActive(false);
        }
    }, [isMapExpanded, navigatorActive]);

    useEffect(() => {
        if (navigatorActive) {
            startBackgroundLocationTracking();
        } else {
            stopBackgroundLocationTracking();
        }
        return () => {
            stopBackgroundLocationTracking();
        };
    }, [navigatorActive]);

    useEffect(() => {
        if (!key) {
            setKey(Math.random().toString());
        }
    }, [key]);

    useEffect(() => {
        if (
            pendingNavigationRef.current &&
            origin &&
            destination &&
            !loading &&
            !navigatorActive
        ) {
            pendingNavigationRef.current = false;
            setNavigatorActive(true);
        }
    }, [origin, destination, loading, navigatorActive]);
    const headerIconColor = isMapExpanded ? palette.mainBlue : palette.blackText;

    return (
        <View style={styles.screen}>
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                            navigation.goBack();
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={22} color={palette.blackText} />
                    </TouchableOpacity>

                    <View style={styles.headerInfo}>
                        <Text style={styles.titleText} numberOfLines={1}>
                            {data?.name || 'Checkpoint'}
                        </Text>
                        <View style={styles.headerMetaRow}>
                            {derivedAddress ? (
                                <View style={styles.metaItem}>
                                    <Ionicons
                                        name="location-outline"
                                        size={16}
                                        color={palette.blackText + '70'}
                                        style={styles.metaIcon}
                                    />
                                    <Text style={styles.metaText} numberOfLines={2}>
                                        {derivedAddress}
                                    </Text>
                                </View>
                            ) : null}
                            {scheduleLabel ? (
                                <View style={styles.metaItem}>
                                    <Ionicons
                                        name="time-outline"
                                        size={16}
                                        color={palette.blackText + '70'}
                                        style={styles.metaIcon}
                                    />
                                    <Text style={styles.metaText}>{scheduleLabel}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.mapToggleButton,
                            isMapExpanded && styles.mapToggleButtonActive,
                        ]}
                        onPress={() => {
                            if (isMapExpanded) {
                                pendingNavigationRef.current = false;
                            }
                            setIsMapExpanded((prev) => !prev);
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="map-outline" size={18} color={headerIconColor} />
                    </TouchableOpacity>
                </View>

                {errorMessage && !isMapExpanded ? (
                    <Text style={styles.inlineError}>{errorMessage}</Text>
                ) : null}

                {isMapExpanded ? (
                    <View style={styles.mapSection}>
                        {loading ? (
                            <View style={styles.mapLoading}>
                                <ActivityIndicator size="large" color={palette.mainBlue} />
                            </View>
                        ) : origin && destination ? (
                            key && (
                                <View style={styles.mapWrapper}>
                                    <GoogleMapComponent
                                        key={key}
                                        origin={origin}
                                        destination={destination}
                                        waypoints={[]}
                                        encodedRoute={encodedRoute}
                                        navigator={navigatorActive}
                                    />
                                </View>
                            )
                        ) : (
                            <View style={styles.mapLoading}>
                                <Text style={styles.inlineError}>
                                    {errorMessage || 'Map unavailable.'}
                                </Text>
                            </View>
                        )}
                    </View>
                ) : null}

                <View style={styles.quickActionsRow}>
                    <QuickActionButton
                        icon="call-outline"
                        label="Call Dispatch"
                        disabled={!dispatchPhone}
                        onPress={() => handleCallPress(dispatchPhone)}
                        styles={styles}
                        palette={palette}
                    />
                    <QuickActionButton
                        icon="call"
                        label="Contact Office"
                        disabled={!officePhone}
                        onPress={() => handleCallPress(officePhone)}
                        styles={styles}
                        palette={palette}
                    />
                    <QuickActionButton
                        icon="chatbubble-ellipses-outline"
                        label="Text Dispatch"
                        disabled={!idRoute}
                        onPress={() => navigation.navigate('ChatComponent', { menu: false, idRoute })}
                        styles={styles}
                        palette={palette}
                    />
                </View>

                <View style={styles.primaryActionsRow}>
                    <TouchableOpacity
                        style={[
                            styles.primaryActionButton,
                            isNavigationEnabled
                                ? styles.primaryActionButtonEnabled
                                : styles.primaryActionButtonDisabled,
                        ]}
                        onPress={handleNavigatePress}
                        disabled={!isNavigationEnabled}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={[
                                styles.primaryActionText,
                                isNavigationEnabled
                                    ? styles.primaryActionTextEnabled
                                    : styles.primaryActionTextDisabled,
                            ]}
                        >
                            Navigate
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.primaryActionButton,
                            canStartVisit && !isStartingVisit
                                ? styles.primaryActionButtonEnabled
                                : styles.primaryActionButtonDisabled,
                        ]}
                        onPress={handleStartVisitPress}
                        disabled={!canStartVisit || isStartingVisit}
                        activeOpacity={0.85}
                    >
                        <Text
                            style={[
                                styles.primaryActionText,
                                canStartVisit && !isStartingVisit
                                    ? styles.primaryActionTextEnabled
                                    : styles.primaryActionTextDisabled,
                            ]}
                        >
                            {isStartingVisit ? 'Starting...' : 'Start Visit'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {visitInfoHtml ? (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={handleInfoToggle}
                        style={styles.infoHtmlTouchable}
                    >
                        <View
                            style={[
                                styles.sectionCard,
                                styles.infoHtmlCard,
                                infoExpanded && styles.infoHtmlCardExpanded,
                            ]}
                        >
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionHeaderLeft}>
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={18}
                                        color={palette.mainBlue}
                                    />
                                    <Text style={styles.sectionTitle}>Visit Information</Text>
                                </View>
                                <Ionicons
                                    name={infoExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={palette.blackText + '60'}
                                />
                            </View>
                            <View style={[styles.infoHtmlContent, { height: infoCardHeight }]}>
                                <WebView
                                    originWhitelist={['*']}
                                    source={{ html: visitInfoHtml }}
                                    scrollEnabled={false}
                                    onMessage={handleInfoWebViewMessage}
                                    injectedJavaScript={infoInjectedScript}
                                    style={styles.infoWebView}
                                />
                            </View>
                            {!infoExpanded ? <View style={styles.infoFade} pointerEvents="none" /> : null}
                        </View>
                    </TouchableOpacity>
                ) : visitInfoItems.length > 0 ? (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderLeft}>
                                <Ionicons
                                    name="information-circle-outline"
                                    size={18}
                                    color={palette.mainBlue}
                                />
                                <Text style={styles.sectionTitle}>Visit Information</Text>
                            </View>
                        </View>
                        {visitInfoItems.map((item, index) => (
                            <Text key={`${item.label}-${index}`} style={styles.sectionBullet}>
                                {'\u2022'}{' '}
                                {item.label ? `${item.label}: ` : ''}
                                {item.value}
                            </Text>
                        ))}
                    </View>
                ) : null}

                {visitScheduleItems.length > 0 ? (
                    <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderLeft}>
                                <Ionicons name="time-outline" size={18} color={palette.mainBlue} />
                                <Text style={styles.sectionTitle}>Visit Schedule</Text>
                            </View>
                        </View>
                        {visitScheduleItems.map((item, index) => (
                            <Text key={`${item.label}-${index}`} style={styles.sectionBullet}>
                                {'\u2022'}{' '}
                                {item.label ? `${item.label}: ` : ''}
                                {item.value}
                            </Text>
                        ))}
                    </View>
                ) : null}
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
        </View>
    );
};

const createCheckpointViewColors = (tokens) => ({
    mainBlue: tokens.primary,
    mainRed: tokens.destructive,
    blackText: tokens.textPrimary,
    lightGray: tokens.border,
    white: tokens.cardBackground,
    background: tokens.background,
    onPrimary: tokens.primaryForeground || '#FFFFFF',
});

const createCheckpointViewStyles = (palette) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: palette.background,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 120,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.mainBlue + '10',
    },
    headerInfo: {
        flex: 1,
        marginHorizontal: 16,
    },
    titleText: {
        fontSize: Fonts.f20,
        color: palette.blackText,
        fontWeight: '700',
        marginBottom: 8,
    },
    headerMetaRow: {
        gap: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaIcon: {
        marginRight: 6,
    },
    metaText: {
        flexShrink: 1,
        fontSize: Fonts.f12,
        color: palette.blackText + '80',
    },
    mapToggleButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: palette.lightGray,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapToggleButtonActive: {
        backgroundColor: palette.mainBlue + '20',
        borderWidth: 1,
        borderColor: palette.mainBlue,
    },
    inlineError: {
        marginBottom: 12,
        fontSize: Fonts.f12,
        color: palette.mainRed,
    },
    mapSection: {
        borderRadius: 24,
        backgroundColor: palette.white,
        padding: 12,
        marginBottom: 24,
        shadowColor: palette.blackText + '10',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    mapWrapper: {
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
    },
    mapLoading: {
        height: 240,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    quickActionButton: {
        flex: 1,
        marginHorizontal: 4,
        borderRadius: 16,
        backgroundColor: palette.mainBlue + '12',
        alignItems: 'center',
        paddingVertical: 14,
    },
    quickActionButtonDisabled: {
        backgroundColor: palette.lightGray,
    },
    quickActionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.white,
        marginBottom: 8,
    },
    quickActionIconDisabled: {
        backgroundColor: palette.white,
        borderWidth: 1,
        borderColor: palette.lightGray,
    },
    quickActionLabel: {
        fontSize: Fonts.f12,
        color: palette.blackText,
        fontWeight: '600',
        textAlign: 'center',
    },
    quickActionLabelDisabled: {
        color: palette.blackText + '50',
    },
    primaryActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
    },
    primaryActionButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: palette.lightGray,
        backgroundColor: palette.white,
    },
    primaryActionButtonEnabled: {
        borderColor: palette.mainBlue,
        backgroundColor: palette.mainBlue + '10',
    },
    primaryActionButtonDisabled: {
        backgroundColor: palette.lightGray + '40',
        borderColor: palette.lightGray,
    },
    primaryActionText: {
        fontSize: Fonts.f16,
        fontWeight: '600',
        color: palette.blackText,
    },
    primaryActionTextEnabled: {
        color: palette.mainBlue,
    },
    primaryActionTextDisabled: {
        color: palette.blackText + '40',
    },
    sectionCard: {
        backgroundColor: palette.white,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: palette.lightGray,
        padding: 18,
        marginBottom: 16,
        shadowColor: palette.blackText + '10',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        marginLeft: 8,
        fontSize: Fonts.f16,
        color: palette.blackText,
        fontWeight: '700',
    },
    sectionBullet: {
        fontSize: Fonts.f12,
        color: palette.blackText + '90',
        marginBottom: 6,
        lineHeight: 18,
    },
    infoHtmlTouchable: {
        width: '100%',
    },
    infoHtmlCard: {
        position: 'relative',
        paddingBottom: 0,
    },
    infoHtmlCardExpanded: {
        paddingBottom: 18,
    },
    infoHtmlContent: {
        width: '100%',
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: palette.white,
    },
    infoWebView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    infoFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 40,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        backgroundColor: palette.white + 'DD',
    },
});

const CheckpointViewPage = (props) => (
    <ThemeProvider>
        <CheckpointViewPageContent {...props} />
    </ThemeProvider>
);

export default CheckpointViewPage;




