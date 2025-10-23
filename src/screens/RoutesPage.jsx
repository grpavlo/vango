
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import { serverUrlApi } from "../const/api";
import { formatDuration } from "../function/function";
import { convertMetersToMiles } from "../function/convertMetersToMiles";
import { useRouteStore } from "../store/useRouteStore";
import { initSignalR, registerSignalRBackgroundTask } from "../services/SignalRService";

const formatStartTime = (value) => {
    if (value === undefined || value === null) {
        return "--";
    }

    if (typeof value === "string") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
    }

    if (typeof value === "number") {
        const base = new Date(0);
        base.setSeconds(value);
        return base.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return "--";
};

const createPageStyles = ({ tokens, spacing, typography }) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: tokens.background
        },
        content: {
            flex: 1,
            paddingHorizontal: spacing.base,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xxl
        },
        headingTitle: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.primary
        },
        headingSubtitle: {
            marginTop: spacing.xs,
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginBottom: spacing.base
        },
        listContent: {
            flexGrow: 1,
            paddingBottom: spacing.xxl
        },
        errorText: {
            marginTop: spacing.base,
            textAlign: "center",
            color: tokens.destructive,
            fontSize: typography.sizes.label
        },
        emptyState: {
            marginTop: spacing.xxl,
            alignItems: "center",
            paddingHorizontal: spacing.xl
        },
        emptyIconWrapper: {
            height: 72,
            width: 72,
            borderRadius: 36,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.mutedBackground,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.base
        },
        emptyTitle: {
            fontSize: typography.sizes.subtitle,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary,
            marginBottom: spacing.xs
        },
        emptyDescription: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            textAlign: "center"
        }
    });

const createCardStyles = ({ tokens, spacing, radii, typography }) =>
    StyleSheet.create({
        card: {
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: spacing.base,
            marginBottom: spacing.base,
            shadowColor: tokens.navShadow,
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm
        },
        cardTitle: {
            fontSize: typography.sizes.body,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        stopsRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.xs
        },
        stopsText: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginLeft: spacing.xs
        },
        scheduleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.xs
        },
        scheduleGroup: {
            flexDirection: "row",
            alignItems: "center"
        },
        scheduleText: {
            fontSize: typography.sizes.caption,
            color: tokens.textSecondary
        },
        scheduleHighlight: {
            fontSize: typography.sizes.caption,
            color: tokens.textPrimary,
            fontWeight: typography.weights.medium
        },
        progressShell: {
            height: 6,
            borderRadius: 3,
            backgroundColor: tokens.mutedBackground,
            overflow: "hidden",
            marginTop: spacing.sm
        },
        progressFill: {
            height: "100%",
            borderRadius: 3,
            backgroundColor: tokens.primary
        },
        progressRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: spacing.sm
        },
        progressLabel: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary
        },
        progressValue: {
            fontSize: typography.sizes.label,
            color: tokens.textPrimary,
            fontWeight: typography.weights.medium
        },
        statusBadge: {
            fontSize: typography.sizes.caption,
            color: tokens.primary
        }
    });

const RouteCard = ({ item, onPress }) => {
    const { tokens, spacing, radii, typography } = useDesignSystem();
    const styles = useMemo(() => createCardStyles({ tokens, spacing, radii, typography }), [tokens, spacing, radii, typography]);

    const completedStops = item.visitFinishedCount || 0;
    const totalStops = item.visitCount || 0;

    const durationLabel = item.estimatedDuration ? formatDuration(item.estimatedDuration) : "N/A";
    const distanceLabel = item.estimatedDistance ? `${convertMetersToMiles(item.estimatedDistance)} mi` : "N/A";
    const startTimeLabel = formatStartTime(item.startTime ?? item.scheduledStartTime ?? item.plannedStartTime);

    const statusLabel = item.started ? (item.finished ? "Completed" : "In progress") : "Not started";
    const progressRatio = totalStops ? Math.min(100, (completedStops / totalStops) * 100) : 0;
    const statusColor =
        statusLabel === "Completed"
            ? "#22c55e"
            : statusLabel === "In progress"
            ? "#f97316"
            : tokens.textMuted;

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name || "Route"}</Text>
                <Ionicons name="chevron-forward" size={18} color={tokens.textMuted} />
            </View>

            <View style={styles.stopsRow}>
                <Ionicons name="location-outline" size={16} color={tokens.textMuted} />
                <Text style={styles.stopsText}>{`${completedStops}/${totalStops} stops completed`}</Text>
            </View>

            <View style={styles.scheduleRow}>
                <View style={styles.scheduleGroup}>
                    <Ionicons name="time-outline" size={16} color={tokens.textMuted} />
                    <Text style={[styles.scheduleHighlight, { marginLeft: spacing.xs }]}>
                        {startTimeLabel}
                    </Text>
                    <Text style={[styles.scheduleText, { marginLeft: spacing.xs / 2 }]}>
                        {` · ${durationLabel}`}
                    </Text>
                </View>
                <View style={styles.scheduleGroup}>
                    <Ionicons name="navigate-outline" size={16} color={tokens.textMuted} />
                    <Text style={[styles.scheduleText, { marginLeft: spacing.xs }]}>{distanceLabel}</Text>
                </View>
            </View>

            {statusLabel !== "Not started" && (
                <>
                    <View style={styles.progressShell}>
                        <View style={[styles.progressFill, { width: `${progressRatio}%`, backgroundColor: statusColor }]} />
                    </View>

                    <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>
                            Visits{" "}
                            <Text style={styles.progressValue}>
                                {completedStops}/{totalStops}
                            </Text>
                        </Text>
                        <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </>
            )}
        </TouchableOpacity>
    );
};

const RoutesPageContent = ({ navigation }) => {
    const { tokens, spacing, typography } = useDesignSystem();
    const styles = useMemo(() => createPageStyles({ tokens, spacing, typography }), [tokens, spacing, typography]);

    const { routeChangeReason } = useRouteStore();
    const isFocused = useIsFocused();

    const [routesData, setRoutesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchRoutes = useCallback(async () => {
        try {
            setLoading(true);
            const accessToken = await SecureStore.getItemAsync("accessToken");
            const today = new Date();
            const formattedDate = today.toISOString().split("T")[0];
            const response = await fetch(`${serverUrlApi}routes/me?date=${formattedDate}`, {
                method: "GET",
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${accessToken}`
                }
            });
            if (response.status === 200) {
                const data = await response.json();
                setRoutesData(Array.isArray(data) ? data : []);
                setErrorMessage("");
            } else if (response.status === 401) {
                setErrorMessage("Unauthorized access. Please log in again.");
            } else {
                setErrorMessage("Failed to fetch routes.");
            }
        } catch (error) {
            setErrorMessage("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    useEffect(() => {
        if (isFocused && (routeChangeReason === 1 || routeChangeReason === 2)) {
            fetchRoutes();
        }
    }, [routeChangeReason, isFocused, fetchRoutes]);

    useEffect(() => {
        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            e.preventDefault();
        });
        return unsubscribe;
    }, [navigation]);

    const anyRouteStarted = routesData.some((routeItem) => routeItem.started && !routeItem.finished);

    useEffect(() => {
        (async () => {
            if (!anyRouteStarted) {
                await SecureStore.deleteItemAsync("idRoute");
            }
        })();
    }, [anyRouteStarted]);

    useEffect(() => {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false
            })
        });

        (async () => {
            await Notifications.setNotificationChannelAsync("default", {
                name: "Default",
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#FF231F7C"
            });
        })();

        (async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== "granted") {
                console.log("Notification permissions not granted");
            }
        })();

        initSignalR();
        registerSignalRBackgroundTask();
    }, []);

    const renderRouteCard = ({ item }) => (
        <RouteCard
            item={item}
            onPress={() => {
                navigation.navigate("RouteCheckpointsPage", { idRoute: item.id });
            }}
        />
    );

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <Text style={styles.headingTitle}>Your routes for today</Text>
                <Text style={styles.headingSubtitle}>
                    Tap a route to view details, or use quick actions to start immediately.
                </Text>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                {loading ? (
                    <ActivityIndicator size="large" color={tokens.primary} style={{ marginTop: spacing.xl }} />
                ) : routesData.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrapper}>
                            <Ionicons name="map-outline" size={28} color={tokens.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>No routes assigned</Text>
                        <Text style={styles.emptyDescription}>
                            You don't have any routes scheduled for today. Check back later or contact dispatch.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={routesData}
                        keyExtractor={(item) => (item.id ? item.id.toString() : Math.random().toString())}
                        renderItem={renderRouteCard}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            <BottomNavigationMenu navigation={navigation} activeTab="Routes" />
        </View>
    );
};

const RoutesPage = (props) => (
    <ThemeProvider>
        <RoutesPageContent {...props} />
    </ThemeProvider>
);

export default RoutesPage;
