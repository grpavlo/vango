import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { useIsFocused } from "@react-navigation/native";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import { serverUrlApi } from "../const/api";
import { LocationContext } from "../components/LocationProvider";
import { useRouteStore } from "../store/useRouteStore";
import { useAppAlert } from "../hooks/useAppAlert";

const withAlpha = (hex, alpha = "1A") => {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

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

const createStyles = ({ tokens, spacing, typography, radii }) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: tokens.background
        },
        header: {
            backgroundColor: tokens.cardBackground,
            borderBottomWidth: 1,
            borderBottomColor: tokens.border,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
        },
        headerTitleGroup: {
            flex: 1
        },
        appTitle: {
            fontSize: typography.sizes.display,
            fontWeight: typography.weights.bold,
            color: tokens.textPrimary
        },
        headerSubtitle: {
            marginTop: spacing.xs,
            fontSize: typography.sizes.label,
            color: tokens.textSecondary
        },
        statusPill: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            marginTop: spacing.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 4,
            borderRadius: radii.pill,
            backgroundColor: withAlpha(tokens.primary, "14")
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tokens.primary,
            marginRight: 6
        },
        statusText: {
            fontSize: typography.sizes.caption,
            fontWeight: typography.weights.medium,
            color: tokens.primary
        },
        statusHint: {
            marginTop: spacing.xs,
            fontSize: typography.sizes.caption,
            color: tokens.textSecondary
        },
        headerActions: {
            flexDirection: "row",
            alignItems: "center",
            marginLeft: spacing.lg
        },
        iconButton: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.mutedBackground,
            marginLeft: spacing.sm
        },
        iconButtonFirst: {
            marginLeft: 0
        },
        notificationBadge: {
            position: "absolute",
            top: 6,
            right: 6,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: tokens.destructive,
            alignItems: "center",
            justifyContent: "center"
        },
        badgeText: {
            color: tokens.destructiveForeground || "#FFFFFF",
            fontSize: typography.sizes.micro,
            fontWeight: typography.weights.bold
        },
        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: spacing.base,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xxl + spacing.lg
        },
        card: {
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: spacing.base,
            shadowColor: "#0F172A",
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
        },
        cardTitle: {
            fontSize: typography.sizes.subtitle,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        routeName: {
            marginTop: spacing.xs,
            fontSize: typography.sizes.body,
            color: tokens.textSecondary
        },
        startButton: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tokens.primary,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm
        },
        startButtonText: {
            marginLeft: spacing.xs,
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.semibold,
            color: tokens.primaryForeground || "#FFFFFF"
        },
        metricsRow: {
            flexDirection: "row",
            marginTop: spacing.base
        },
        metricCard: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tokens.mutedBackground,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: tokens.outline,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            marginRight: spacing.sm
        },
        metricCardLast: {
            marginRight: 0
        },
        metricIconWrapper: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            marginRight: spacing.sm
        },
        metricValue: {
            fontSize: typography.sizes.subtitle,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        metricLabel: {
            fontSize: typography.sizes.caption,
            color: tokens.textSecondary,
            marginTop: 2
        },
        availableRoutes: {
            marginTop: spacing.base,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
            paddingTop: spacing.sm
        },
        availableRoutesTitle: {
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.semibold,
            color: tokens.textSecondary,
            marginBottom: spacing.xs
        },
        availableRouteItem: {
            paddingVertical: spacing.xs
        },
        availableRouteText: {
            fontSize: typography.sizes.caption,
            color: tokens.textSecondary
        },
        availableRouteMeta: {
            fontSize: typography.sizes.micro,
            color: tokens.textMuted,
            marginTop: 2
        },
        availableRoutesEmptyText: {
            fontSize: typography.sizes.caption,
            color: tokens.textMuted
        },
        cardEmptyState: {
            paddingVertical: spacing.lg
        },
        cardEmptyTitle: {
            fontSize: typography.sizes.subtitle,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        cardEmptyDescription: {
            marginTop: spacing.xs,
            fontSize: typography.sizes.label,
            color: tokens.textSecondary
        },
        actionSectionsWrapper: {
            marginTop: spacing.xl
        },
        actionSection: {
            marginBottom: spacing.xl
        },
        actionSectionSpacing: {
            marginTop: spacing.lg
        },
        sectionDivider: {
            height: 1,
            backgroundColor: tokens.border,
            marginBottom: spacing.base
        },
        actionRow: {
            flexDirection: "row",
            marginBottom: spacing.sm
        },
        actionRowLast: {
            marginBottom: 0
        },
        actionCard: {
            flex: 1,
            minHeight: 116,
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: tokens.border,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.base,
            paddingHorizontal: spacing.sm,
            marginRight: spacing.sm,
            shadowColor: "#0F172A",
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3
        },
        actionCardLast: {
            marginRight: 0
        },
        actionIconWrapper: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center"
        },
        actionLabel: {
            marginTop: spacing.sm,
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.medium,
            color: tokens.textPrimary,
            textAlign: "center"
        }
    });

const ActionListsPageContent = ({ navigation }) => {
    const { tokens, spacing, typography, radii } = useDesignSystem();
    const styles = useMemo(
        () => createStyles({ tokens, spacing, typography, radii }),
        [tokens, spacing, typography, radii]
    );
    const { showAlert } = useAppAlert();

    const accentColors = useMemo(
        () => ({
            primary: {
                icon: tokens.primary,
                background: withAlpha(tokens.primary, "1A")
            },
            warning: {
                icon: "#F97316",
                background: withAlpha("#F97316", "1A")
            }
        }),
        [tokens]
    );

    const routeChangeReason = useRouteStore((state) => state.routeChangeReason);
    const isFocused = useIsFocused();
    const locationContext = useContext(LocationContext) || {};
    const { locationError } = locationContext;

    const [notificationCount, setNotificationCount] = useState(0);
    const [networkState, setNetworkState] = useState(null);
    const [gpsState, setGpsState] = useState({
        servicesEnabled: null,
        permissionGranted: null
    });
    const [routesData, setRoutesData] = useState([]);
    const [routesLoading, setRoutesLoading] = useState(false);
    const [routesError, setRoutesError] = useState("");

    useEffect(() => {
        let isMounted = true;

        const fetchNotificationCount = async () => {
            try {
                const accessToken = await SecureStore.getItemAsync("accessToken");
                if (!accessToken) {
                    return;
                }

                const response = await fetch(`${serverUrlApi}route-changes/me/count`, {
                    method: "GET",
                    headers: {
                        accept: "application/json",
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (isMounted && typeof data === "number") {
                    setNotificationCount(data);
                }
            } catch (error) {
                console.log("Home notification count fetch error:", error);
            }
        };

        fetchNotificationCount();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleNavigateToNotifications = useCallback(() => {
        navigation.navigate("NotificationsScreen");
    }, [navigation]);

    const handleNavigateToSettings = useCallback(() => {
        navigation.navigate("SettingsPage");
    }, [navigation]);

    const handleNavigateToRoutes = useCallback(() => {
        navigation.navigate("RoutesPage");
    }, [navigation]);

    const handleNavigateToMap = useCallback(() => {
        navigation.navigate("MapPage");
    }, [navigation]);

    const handleNavigateToManifest = useCallback(() => {
        navigation.navigate("SamplesScreen");
    }, [navigation]);

    const handleNavigateToReceiveFromDrivers = useCallback(() => {
        navigation.navigate("ReceiveSamplesFromDriversPage");
    }, [navigation]);

    const handleComingSoon = useCallback(() => {
        showAlert({
            title: "Coming Soon",
            message: "This quick action will be available in an upcoming update.",
            variant: "info",
        });
    }, [showAlert]);

    useEffect(() => {
        let isMounted = true;
        let networkSubscription;
        let fallbackInterval;

        const updateNetworkState = async () => {
            try {
                const state = await Network.getNetworkStateAsync();
                if (isMounted) {
                    setNetworkState(state);
                }
            } catch (error) {
                console.log("Home network status error:", error);
            }
        };

        updateNetworkState();

        if (typeof Network.addNetworkStateListener === "function") {
            networkSubscription = Network.addNetworkStateListener((state) => {
                if (isMounted) {
                    setNetworkState(state);
                }
            });
        } else {
            fallbackInterval = setInterval(updateNetworkState, 5000);
        }

        return () => {
            isMounted = false;
            networkSubscription?.remove?.();
            if (fallbackInterval) {
                clearInterval(fallbackInterval);
            }
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const updateLocationState = async () => {
            try {
                const [servicesEnabled, foregroundPermissions] = await Promise.all([
                    Location.hasServicesEnabledAsync(),
                    Location.getForegroundPermissionsAsync().catch(() => null)
                ]);

                if (!isMounted) {
                    return;
                }

                setGpsState({
                    servicesEnabled,
                    permissionGranted: (foregroundPermissions?.status || "undetermined") === "granted"
                });
            } catch (error) {
                console.log("Home location status error:", error);
                if (isMounted) {
                    setGpsState((current) => ({
                        ...current,
                        servicesEnabled: false
                    }));
                }
            }
        };

        updateLocationState();
        const interval = setInterval(updateLocationState, 15000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (locationError) {
            setGpsState((current) => ({
                ...current,
                permissionGranted: false
            }));
        }
    }, [locationError]);

    const networkReady = useMemo(() => {
        if (networkState === null) {
            return null;
        }
        if (networkState.isConnected === false) {
            return false;
        }
        if (networkState.isInternetReachable === false) {
            return false;
        }
        return true;
    }, [networkState]);

    const gpsReady = useMemo(() => {
        if (gpsState.servicesEnabled === null || gpsState.permissionGranted === null) {
            return null;
        }
        if (!gpsState.servicesEnabled) {
            return false;
        }
        if (!gpsState.permissionGranted) {
            return false;
        }
        return true;
    }, [gpsState]);

    const statusTheme = useMemo(() => {
        if (networkReady === null || gpsReady === null) {
            const neutral = tokens.textSecondary;
            return {
                label: "Checking...",
                textColor: neutral,
                dotColor: neutral,
                backgroundColor: withAlpha(neutral, "1A"),
                message: "Checking connectivity..."
            };
        }

        if (!networkReady) {
            const color = tokens.destructive;
            return {
                label: "Offline",
                textColor: color,
                dotColor: color,
                backgroundColor: withAlpha(color, "1A"),
                message: "No internet connection"
            };
        }

        if (!gpsReady) {
            const color = "#F97316";
            return {
                label: "GPS inactive",
                textColor: color,
                dotColor: color,
                backgroundColor: withAlpha(color, "1A"),
                message: "Enable location services"
            };
        }

        const color = tokens.primary;
        return {
            label: "Online",
            textColor: color,
            dotColor: color,
            backgroundColor: withAlpha(color, "14"),
            message: ""
        };
    }, [networkReady, gpsReady, tokens]);

    const statusHintColor = useMemo(() => {
        if (!statusTheme.message) {
            return tokens.textSecondary;
        }
        if (statusTheme.label === "Checking...") {
            return tokens.textSecondary;
        }
        return statusTheme.textColor;
    }, [statusTheme, tokens]);

    const fetchRoutes = useCallback(async () => {
        try {
            setRoutesLoading(true);
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                setRoutesData([]);
                setRoutesError("Authorization required. Please sign in again.");
                return;
            }

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
                setRoutesError("");
            } else if (response.status === 401) {
                setRoutesData([]);
                setRoutesError("Unauthorized access. Please log in again.");
            } else {
                setRoutesError("Failed to fetch routes.");
            }
        } catch (error) {
            console.log("Home routes fetch error:", error);
            setRoutesError("An error occurred. Please try again.");
        } finally {
            setRoutesLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) {
            fetchRoutes();
        }
    }, [isFocused, routeChangeReason, fetchRoutes]);

    const activeRoute = useMemo(() => {
        if (!routesData.length) {
            return null;
        }
        const inProgress = routesData.find((route) => route.started && !route.finished);
        if (inProgress) {
            return inProgress;
        }
        return routesData[0];
    }, [routesData]);

    const otherRoutes = useMemo(() => {
        if (!routesData.length || !activeRoute) {
            return [];
        }
        return routesData.filter((route) => route.id !== activeRoute.id);
    }, [routesData, activeRoute]);

    const otherRouteItems = useMemo(
        () =>
            otherRoutes.map((route, index) => {
                const startLabel = formatStartTime(
                    route.startTime ?? route.scheduledStartTime ?? route.plannedStartTime
                );
                const statusLabel = route.started
                    ? route.finished
                        ? "Completed"
                        : "In progress"
                    : "Not started";

                return {
                    id: route.id ?? `${route.name || "route"}-${index}`,
                    label: route.name || "Route",
                    details: `${startLabel} - ${statusLabel}`
                };
            }),
        [otherRoutes]
    );

    const startButtonLabel = useMemo(() => {
        if (!activeRoute) {
            return "View routes";
        }
        if (activeRoute.started && !activeRoute.finished) {
            return "Continue";
        }
        if (activeRoute.finished) {
            return "Open";
        }
        return "Start";
    }, [activeRoute]);



    const handleStartRoute = useCallback(() => {
        if (activeRoute?.id) {
            navigation.navigate("RouteCheckpointsPage", { idRoute: activeRoute.id });
        } else {
            navigation.navigate("RoutesPage");
        }
    }, [navigation, activeRoute]);

    const handleActiveRouteDetails = useCallback(() => {
        if (activeRoute?.id) {
            navigation.navigate("RouteCheckpointsPage", { idRoute: activeRoute.id });
        } else {
            navigation.navigate("RoutesPage");
        }
    }, [navigation, activeRoute]);

    const quickActionsPrimary = useMemo(
        () => [
            {
                key: "routes",
                label: "My Routes",
                icon: "navigate-outline",
                accent: "primary",
                onPress: handleNavigateToRoutes
            },
            {
                key: "map",
                label: "Map",
                icon: "map-outline",
                accent: "primary",
                onPress: handleNavigateToMap
            },
            {
                key: "manifest",
                label: "My Manifest",
                icon: "document-text-outline",
                accent: "primary",
                onPress: handleNavigateToManifest
            }
        ],
        [handleNavigateToRoutes, handleNavigateToMap, handleNavigateToManifest]
    );

    const quickActionsSecondary = useMemo(
        () => [
            {
                key: "pick-up",
                label: "Receive samples from drivers",
                icon: "people-outline",
                accent: "primary",
                onPress: handleNavigateToReceiveFromDrivers
            },
            {
                key: "drop-off",
                label: "Drop Off to Lab",
                icon: "flask-outline",
                accent: "primary",
                onPress: handleComingSoon
            },
            {
                key: "ship",
                label: "Ship",
                icon: "cube-outline",
                accent: "primary",
                onPress: handleComingSoon
            }
        ],
        [handleNavigateToReceiveFromDrivers, handleComingSoon]
    );

    const quickActionsSupport = useMemo(
        () => [
            {
                key: "dispatcher-assist",
                label: "Request dispatcher assistance",
                icon: "alert-circle-outline",
                accent: "warning",
                onPress: handleComingSoon
            },
            {
                key: "transfer",
                label: "Contact another driver to transfer your samples",
                icon: "swap-horizontal",
                accent: "primary",
                onPress: handleComingSoon
            },
            {
                key: "call-dispatcher",
                label: "Call dispatcher",
                icon: "call-outline",
                accent: "warning",
                onPress: handleComingSoon
            }
        ],
        [handleComingSoon]
    );

    const actionSections = useMemo(
        () => [quickActionsPrimary, quickActionsSecondary, quickActionsSupport],
        [quickActionsPrimary, quickActionsSecondary, quickActionsSupport]
    );

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTitleGroup}>
                        <Text style={styles.appTitle}>Route Logs</Text>
                        <View
                            style={[
                                styles.statusPill,
                                { backgroundColor: statusTheme.backgroundColor }
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: statusTheme.dotColor }
                                ]}
                            />
                            <Text
                                style={[styles.statusText, { color: statusTheme.textColor }]}
                            >
                                {statusTheme.label}
                            </Text>
                        </View>
                        {statusTheme.message ? (
                            <Text style={[styles.statusHint, { color: statusHintColor }]}>
                                {statusTheme.message}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={[styles.iconButton, styles.iconButtonFirst]}
                            onPress={handleNavigateToNotifications}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="notifications-outline" size={22} color={tokens.textPrimary} />
                            {notificationCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.badgeText}>
                                        {notificationCount > 99 ? "99+" : notificationCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={handleNavigateToSettings}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="settings-outline" size={22} color={tokens.textPrimary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {routesLoading ? (
                        <View style={styles.cardEmptyState}>
                            <Text style={styles.cardEmptyTitle}>Loading routes...</Text>
                            <Text style={styles.cardEmptyDescription}>
                                Fetching your assignments for today.
                            </Text>
                        </View>
                    ) : routesError ? (
                        <View style={styles.cardEmptyState}>
                            <Text style={styles.cardEmptyTitle}>Unable to load routes</Text>
                            <Text style={styles.cardEmptyDescription}>{routesError}</Text>
                        </View>
                    ) : activeRoute ? (
                        <>
                            <View style={styles.cardHeader}>
                                <View>
                                    <Text style={styles.cardTitle}>Active Route</Text>
                                    <TouchableOpacity
                                        onPress={handleActiveRouteDetails}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.routeName}>
                                            {activeRoute.name || "Route"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={styles.startButton}
                                    onPress={handleStartRoute}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons
                                        name="play"
                                        size={16}
                                        color={tokens.primaryForeground || "#FFFFFF"}
                                    />
                                    <Text style={styles.startButtonText}>{startButtonLabel}</Text>
                                </TouchableOpacity>
                            </View>

                            

                            <View style={styles.availableRoutes}>
                                <Text style={styles.availableRoutesTitle}>Other routes today</Text>
                                {otherRouteItems.length > 0 ? (
                                    otherRouteItems.map((route) => (
                                        <TouchableOpacity
                                            key={route.id}
                                            onPress={() => {
                                                if (route.id) {
                                                    navigation.navigate("RouteCheckpointsPage", {
                                                        idRoute: route.id
                                                    });
                                                } else {
                                                    navigation.navigate("RoutesPage");
                                                }
                                            }}
                                            activeOpacity={0.7}
                                            style={styles.availableRouteItem}
                                        >
                                            <Text style={styles.availableRouteText}>{route.label}</Text>
                                            <Text style={styles.availableRouteMeta}>{route.details}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={styles.availableRoutesEmptyText}>
                                        No other routes assigned.
                                    </Text>
                                )}
                            </View>
                        </>
                    ) : (
                        <View style={styles.cardEmptyState}>
                            <Text style={styles.cardEmptyTitle}>No routes for today</Text>
                            <Text style={styles.cardEmptyDescription}>
                                Check back later or contact dispatch.
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.actionSectionsWrapper}>
                    {actionSections.map((section, sectionIndex) => {
                        const rows = chunkArray(section, 3);
                        return (
                            <View
                                key={`section-${sectionIndex}`}
                                style={[
                                    styles.actionSection,
                                    sectionIndex !== 0 && styles.actionSectionSpacing
                                ]}
                            >
                                {sectionIndex !== 0 && <View style={styles.sectionDivider} />}
                                {rows.map((row, rowIndex) => (
                                    <View
                                        key={`section-${sectionIndex}-row-${rowIndex}`}
                                        style={[
                                            styles.actionRow,
                                            rowIndex === rows.length - 1 && styles.actionRowLast
                                        ]}
                                    >
                                        {row.map((action, actionIndex) => {
                                            const accent = accentColors[action.accent || "primary"];
                                            return (
                                                <TouchableOpacity
                                                    key={action.key}
                                                    style={[
                                                        styles.actionCard,
                                                        actionIndex === row.length - 1 && styles.actionCardLast
                                                    ]}
                                                    onPress={action.onPress}
                                                    activeOpacity={0.85}
                                                >
                                                    <View
                                                        style={[
                                                            styles.actionIconWrapper,
                                                            { backgroundColor: accent.background }
                                                        ]}
                                                    >
                                                        <Ionicons
                                                            name={action.icon}
                                                            size={20}
                                                            color={accent.icon}
                                                        />
                                                    </View>
                                                    <Text style={styles.actionLabel} numberOfLines={2}>
                                                        {action.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Home" />
        </View>
    );
};

const ActionListsPage = (props) => (
    <ThemeProvider>
        <ActionListsPageContent {...props} />
    </ThemeProvider>
);

export default ActionListsPage;
