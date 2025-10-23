import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import UniversalModal from '../components/UniversalModal';
import { Fonts } from '../utils/tokens';
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import CheckpointItem from "../components/CheckpointItem";
import * as SecureStore from 'expo-secure-store';
import { serverUrlApi } from "../const/api";
import { useInfoCheckpoint } from "../store/infoCheckpoint";

const FLAG_COLOR_MAP = {
    1: '#FF5630',
    2: '#FFAB00',
    3: '#36B37E',
    4: '#0065FF',
};

const createCheckpointColors = (tokens) => ({
    mainBlue: tokens.primary,
    mainRed: tokens.destructive,
    lightGray: tokens.border,
    blackText: tokens.textPrimary,
    background: tokens.background,
    onPrimary: tokens.primaryForeground || '#FFFFFF',
});

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        container: {
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
        },
        iconButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.mainBlue + '10',
        },
        iconButtonPlaceholder: {
            width: 36,
            height: 36,
        },
        headerTitle: {
            flex: 1,
            marginHorizontal: 16,
            fontSize: Fonts.f20,
            color: palette.blackText,
            fontWeight: '700',
            textAlign: 'center',
        },
        errorText: {
            color: palette.mainRed,
            fontSize: Fonts.f14,
            marginBottom: 12,
            textAlign: 'center',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        summaryRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingVertical: 12,
            paddingHorizontal: 4,
            borderRadius: 16,
            backgroundColor: palette.mainBlue + '08',
        },
        summaryItem: {
            flex: 1,
            paddingHorizontal: 12,
        },
        summaryItemBorder: {
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: palette.lightGray,
        },
        summaryLabel: {
            fontSize: Fonts.f12,
            color: palette.blackText + '80',
        },
        summaryValue: {
            fontSize: Fonts.f16,
            color: palette.blackText,
            fontWeight: '600',
            marginTop: 4,
        },
        startButton: {
            backgroundColor: palette.mainBlue,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            marginBottom: 16,
        },
        startButtonText: {
            color: palette.onPrimary,
            fontSize: Fonts.f16,
            fontWeight: '700',
        },
        listContent: {
            paddingBottom: 120,
        },
        itemSpacer: {
            height: 12,
        },
        emptyState: {
            paddingVertical: 40,
            alignItems: 'center',
        },
        emptyTitle: {
            fontSize: Fonts.f16,
            color: palette.blackText,
            fontWeight: '600',
            marginBottom: 8,
        },
        emptyDescription: {
            fontSize: Fonts.f12,
            color: palette.blackText + '80',
            textAlign: 'center',
            paddingHorizontal: 20,
        },
        completedSection: {
            marginTop: 24,
            borderTopWidth: 1,
            borderTopColor: palette.lightGray,
            paddingTop: 16,
        },
        completedToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        completedToggleLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        completedLabel: {
            fontSize: Fonts.f14,
            color: palette.blackText,
            fontWeight: '600',
            marginLeft: 4,
        },
        completedBadge: {
            minWidth: 28,
            paddingHorizontal: 8,
            height: 24,
            borderRadius: 12,
            backgroundColor: palette.mainBlue + '10',
            alignItems: 'center',
            justifyContent: 'center',
        },
        completedBadgeText: {
            fontSize: Fonts.f12,
            color: palette.mainBlue,
            fontWeight: '600',
        },
        completedList: {
            marginTop: 12,
        },
        completedItemWrapper: {
            marginBottom: 12,
        },
        completedItemLast: {
            marginBottom: 0,
        },
    });

const RouteCheckpointsPage = (props) => (
    <ThemeProvider>
        <RouteCheckpointsPageContent {...props} />
    </ThemeProvider>
);

export default RouteCheckpointsPage;

const toDate = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const date = new Date(0);
        date.setSeconds(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }

        const numeric = Number(value);
        if (!Number.isNaN(numeric)) {
            const secondsDate = new Date(0);
            secondsDate.setSeconds(numeric);
            return Number.isNaN(secondsDate.getTime()) ? null : secondsDate;
        }
    }

    return null;
};

const formatDateTimeLabel = (value) => {
    const date = toDate(value);
    if (!date) {
        return '--';
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfDayAfterTomorrow = new Date(startOfTomorrow);
    startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    let dayLabel;
    if (date >= startOfToday && date < startOfTomorrow) {
        dayLabel = 'Today';
    } else if (date >= startOfTomorrow && date < startOfDayAfterTomorrow) {
        dayLabel = 'Tomorrow';
    } else if (date >= startOfYesterday && date < startOfToday) {
        dayLabel = 'Yesterday';
    } else {
        dayLabel = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }

    const timeLabel = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });

    return `${dayLabel}, ${timeLabel}`;
};

const formatDurationLabel = (durationInSeconds) => {
    if (durationInSeconds === null || durationInSeconds === undefined) {
        return '--';
    }

    const totalSeconds = Number(durationInSeconds);
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return '--';
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

    return parts.length > 0 ? parts.join(' ') : '0m';
};

const secondsToTimeLabel = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const totalSeconds = Number(value);
    if (!Number.isFinite(totalSeconds)) {
        return null;
    }

    const base = new Date(0);
    base.setSeconds(totalSeconds);
    if (Number.isNaN(base.getTime())) {
        return null;
    }

    return base.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
};

const buildHoursRange = (startSeconds, endSeconds) => {
    const startLabel = secondsToTimeLabel(startSeconds);
    const endLabel = secondsToTimeLabel(endSeconds);

    if (startLabel && endLabel) {
        return `${startLabel} - ${endLabel}`;
    }

    return startLabel || endLabel || '';
};

const inferAttentionCount = (visit) => {
    const candidateFields = [
        'notificationsCount',
        'alertsCount',
        'issuesCount',
        'pendingSamplesCount',
        'pendingDocumentsCount',
        'unreadMessagesCount',
    ];

    for (const field of candidateFields) {
        if (visit[field] !== undefined && visit[field] !== null) {
            const numeric = Number(visit[field]);
            if (!Number.isNaN(numeric) && numeric > 0) {
                return numeric;
            }
        }
    }

    return 0;
};

const mapVisitToCheckpoint = (visit, index, palette) => {
    const addressParts = [
        visit.address,
        visit.city,
        visit.state,
        visit.zipCode,
    ].filter(Boolean);

    const flagColor = FLAG_COLOR_MAP[visit.flag] || palette.lightGray;
    const priorityLabel =
        typeof visit.priority === 'string'
            ? visit.priority
            : visit.priority
                ? 'STAT'
                : null;

    const order =
        visit.sequence ??
        visit.sequenceNumber ??
        visit.position ??
        visit.order ??
        index + 1;

    return {
        ...visit,
        id: visit.id ?? `${order}`,
        type: visit.dropOff ? 'unloading' : 'loading',
        name: visit.checkpointName || 'Checkpoint',
        address: addressParts.join(', '),
        hours: buildHoursRange(visit.startTime, visit.endTime),
        flagColor,
        priorityLabel,
        stat: priorityLabel,
        count: order,
        attentionCount: inferAttentionCount(visit),
    };
};

const RouteCheckpointsPageContent = ({ navigation, route }) => {
    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createCheckpointColors(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const { idRoute } = route.params || { idRoute: null };
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [routeDetails, setRouteDetails] = useState({
        id: '',
        name: '',
        started: false,
        startLabel: '--',
        endLabel: '--',
        durationLabel: '--',
    });
    const [checkpoints, setCheckpoints] = useState([]);
    const [completedCheckpoints, setCompletedCheckpoints] = useState([]);
    const [showCompleted, setShowCompleted] = useState(false);
    const { setData: setCheckpointData } = useInfoCheckpoint();

    useEffect(() => {
        const persistRouteId = async () => {
            try {
                if (idRoute) {
                    await SecureStore.setItemAsync('idRoute', String(idRoute));
                } else {
                    await SecureStore.deleteItemAsync('idRoute');
                }
            } catch (error) {
                console.log('Failed to persist route id', error);
            }
        };

        persistRouteId();
    }, [idRoute]);

    useEffect(() => {
        const fetchRoute = async () => {
            setLoading(true);
            setErrorMessage('');

            if (!idRoute) {
                setErrorMessage('Route ID is missing.');
                setLoading(false);
                return;
            }

            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) {
                    setErrorMessage('Authentication token is missing. Please log in again.');
                    setLoading(false);
                    return;
                }

                const response = await fetch(serverUrlApi + `routes/${idRoute}`, {
                    method: 'GET',
                    headers: {
                        accept: 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (response.status === 200) {
                    const data = await response.json();

                    setRouteDetails({
                        id: data.id,
                        name: data.name,
                        started: Boolean(data.started),
                        startLabel: formatDateTimeLabel(data.startDate),
                        endLabel: formatDateTimeLabel(data.endDate),
                        durationLabel: formatDurationLabel(data.estimatedDuration),
                    });

                    const activeVisits = (data.visits || []).map((visit, index) =>
                        mapVisitToCheckpoint(visit, index, palette),
                    );

                    const completedVisits = (data.completedVisits || []).map((visit, index) =>
                        mapVisitToCheckpoint(visit, index, palette),
                    );

                    setCheckpoints(activeVisits);
                    setCompletedCheckpoints(completedVisits);
                    setShowCompleted(false);
                } else if (response.status === 401) {
                    setErrorMessage('Unauthorized access. Please log in again.');
                } else if (response.status === 404) {
                    setErrorMessage('Route not found.');
                } else {
                    setErrorMessage('Failed to fetch route.');
                }
            } catch (error) {
                setErrorMessage('An error occurred. Please try again.');
            }

            setLoading(false);
        };

        fetchRoute();
    }, [idRoute, palette]);

    const handleStartPress = () => {
        setModalVisible(true);
    };

    const handleConfirm = async () => {
        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                setErrorMessage('Authentication token is missing. Please log in again.');
                return;
            }
            const response = await fetch(serverUrlApi + `routes/${idRoute}/start`, {
                method: 'PATCH',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (response.status === 200) {
                setRouteDetails((prev) => ({
                    ...prev,
                    started: true,
                }));
                setModalVisible(false);
                navigation.navigate('ChooseCarPage', {
                    idRoute,
                    routeName: routeDetails.name,
                });
            } else if (response.status === 401) {
                setErrorMessage('Unauthorized access. Please log in again.');
            } else if (response.status === 404) {
                setErrorMessage('Route not found.');
            } else {
                setErrorMessage('Failed to start the route.');
            }
        } catch (error) {
            setErrorMessage('An error occurred while starting the route. Please try again.');
        }
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    const handleCheckpointPress = (checkpoint) => {
        setCheckpointData(checkpoint);
        const allowActions = Boolean(routeDetails.started);
        navigation.navigate('CheckpointViewPage', {
            idCheckpoint: checkpoint.id,
            routeName: routeDetails.name,
            idRoute: routeDetails.id,
            startDate: checkpoint.startDate ?? checkpoint.startTime ?? null,
            last: Boolean(checkpoint.last),
            openMap: allowActions,
            canStartVisit: allowActions,
            canNavigate: allowActions,
        });
    };

    const renderCheckpoint = ({ item }) => (
        <CheckpointItem
            checkpoint={item}
            index={item.count}
            disabled={false}
            onPress={() => handleCheckpointPress(item)}
        />
    );

    const completedSection = completedCheckpoints.length > 0 ? (
        <View style={styles.completedSection}>
            <TouchableOpacity
                style={styles.completedToggle}
                onPress={() => setShowCompleted((prev) => !prev)}
                activeOpacity={0.8}
            >
                <View style={styles.completedToggleLeft}>
                    <Ionicons
                        name={showCompleted ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={palette.blackText}
                    />
                    <Text style={styles.completedLabel}>Completed</Text>
                </View>
                <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>{completedCheckpoints.length}</Text>
                </View>
            </TouchableOpacity>
            {showCompleted ? (
                <View style={styles.completedList}>
                    {completedCheckpoints.map((item, index) => {
                        const key = item.id ? String(item.id) : `completed-${item.count}`;
                        const wrapperStyle =
                            index === completedCheckpoints.length - 1
                                ? styles.completedItemLast
                                : styles.completedItemWrapper;
                        return (
                            <View key={key} style={wrapperStyle}>
                                <CheckpointItem
                                    checkpoint={item}
                                    index={item.count}
                                    disabled={false}
                                    onPress={() => handleCheckpointPress(item)}
                                />
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </View>
    ) : null;

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={24} color={palette.blackText} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={2}>
                        {routeDetails.name || 'Route Overview'}
                    </Text>
                    {routeDetails.id ? (
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() =>
                                navigation.navigate('RouteDescriptionPage', {
                                    idRoute: routeDetails.id,
                                    name: routeDetails.name,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="information-circle-outline"
                                size={24}
                                color={palette.mainBlue}
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.iconButtonPlaceholder} />
                    )}
                </View>
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={palette.mainBlue} />
                    </View>
                ) : (
                    <>
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Start</Text>
                                <Text style={styles.summaryValue}>{routeDetails.startLabel}</Text>
                            </View>
                            <View style={[styles.summaryItem, styles.summaryItemBorder]}>
                                <Text style={styles.summaryLabel}>End</Text>
                                <Text style={styles.summaryValue}>{routeDetails.endLabel}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Duration</Text>
                                <Text style={styles.summaryValue}>{routeDetails.durationLabel}</Text>
                            </View>
                        </View>
                        {!routeDetails.started ? (
                            <TouchableOpacity style={styles.startButton} onPress={handleStartPress}>
                                <Text style={styles.startButtonText}>Start Route</Text>
                            </TouchableOpacity>
                        ) : null}
                        <FlatList
                            data={checkpoints}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderCheckpoint}
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <View style={styles.itemSpacer} />}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyTitle}>No stops scheduled.</Text>
                                    <Text style={styles.emptyDescription}>
                                        Once visits are assigned, they will appear here.
                                    </Text>
                                </View>
                            }
                            ListFooterComponent={completedSection}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                )}
            </View>
            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
            <UniversalModal
                visible={modalVisible}
                title="Ready to Start Route?"
                description="Are you ready to start this route? You'll need to select a vehicle next."
                confirmText="Yes, Start"
                cancelText="Cancel"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </View>
    );
};
