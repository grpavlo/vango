import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { serverUrlApi } from "../const/api";
import { useRouteStore } from "../store/useRouteStore";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";

const STATUS_READ = 1;

const createStyles = ({ tokens, spacing, radii, typography }) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: tokens.background
        },
        content: {
            flex: 1,
            paddingHorizontal: spacing.base,
            paddingTop: 0,
            paddingBottom: spacing.xxl
        },
        topPanel: {
            backgroundColor: tokens.cardBackground,
            borderRadius: 0,
            borderWidth: 0,
            borderColor: tokens.border,
            padding: spacing.base,
            marginHorizontal: -spacing.base,
            marginBottom: spacing.lg,
            shadowColor: tokens.navShadow,
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
        },
        headerLeft: {
            flexDirection: "row",
            alignItems: "center"
        },
        headerTitle: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        backButton: {
            flexDirection: "row",
            alignItems: "center",
            marginRight: spacing.base
        },
        backLabel: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginLeft: spacing.xs
        },
        markAllButton: {
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.xs,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.mutedBackground
        },
        markAllLabel: {
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.medium,
            color: tokens.textPrimary
        },
        unreadLabel: {
            marginTop: spacing.sm,
            fontSize: typography.sizes.label,
            color: tokens.textSecondary
        },
        refreshRow: {
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: spacing.md
        },
        reloadButton: {
            flexDirection: "row",
            alignItems: "center"
        },
        reloadIcon: {
            marginRight: spacing.xs
        },
        reloadLabel: {
            fontSize: typography.sizes.label,
            color: tokens.primary,
            fontWeight: typography.weights.medium
        },
        scrollContent: {
            paddingBottom: spacing.xxl
        },
        card: {
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: spacing.base,
            marginBottom: spacing.base,
            shadowColor: tokens.navShadow,
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6
        },
        cardHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm
        },
        cardTitle: {
            flex: 1,
            fontSize: typography.sizes.body,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary,
            marginRight: spacing.base
        },
        timeSince: {
            fontSize: typography.sizes.caption,
            color: tokens.textMuted
        },
        cardBodyText: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginBottom: spacing.xs
        },
        cardFooter: {
            marginTop: spacing.sm
        },
        cardTimestampRow: {
            flexDirection: "row",
            alignItems: "center"
        },
        cardTimestampIcon: {
            marginRight: spacing.xs
        },
        cardTimestamp: {
            fontSize: typography.sizes.caption,
            color: tokens.textMuted
        },
        emptyState: {
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.xxl,
            paddingHorizontal: spacing.xl
        },
        emptyIconWrapper: {
            height: 72,
            width: 72,
            borderRadius: 36,
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
            textAlign: "center",
            color: tokens.textSecondary
        }
    });

const formatDateString = (dateInput, timeZone = "UTC") => {
    const date = new Date(dateInput);
    const timePart = date
        .toLocaleString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone
        })
        .replace(/\u202F/, " ");

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);

    return `${timePart} ${month}/${day}/${year}`;
};

const getRelativeTime = (dateInput) => {
    const now = new Date();
    const date = new Date(dateInput);
    const diffMs = now - date;
    if (Number.isNaN(diffMs) || diffMs < 0) {
        return "just now";
    }

    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) {
        return "just now";
    }
    if (minutes < 60) {
        return `${minutes} min ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
};

const NotificationsScreenContent = ({ navigation }) => {
    const { tokens, spacing, radii, typography } = useDesignSystem();
    const styles = useMemo(
        () => createStyles({ tokens, spacing, radii, typography }),
        [tokens, spacing, radii, typography]
    );

    const routeChangeReason = useRouteStore((state) => state.routeChangeReason);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.readDate).length,
        [notifications]
    );

    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                setNotifications([]);
                return;
            }

            const response = await axios.get(`${serverUrlApi}route-changes/me`, {
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const payload = Array.isArray(response.data) ? response.data : [];

            await Promise.all(
                payload
                    .filter((item) => !item.readDate)
                    .map((item) =>
                        axios.patch(
                            `${serverUrlApi}route-changes/${item.id}`,
                            { status: STATUS_READ },
                            {
                                headers: {
                                    accept: "application/json",
                                    Authorization: `Bearer ${accessToken}`
                                }
                            }
                        )
                    )
            );

            setNotifications(payload);
        } catch (error) {
            console.log("fetchNotifications error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications, routeChangeReason]);

    const getReasonMessage = (reason, routeName) => {
        switch (reason) {
            case 1:
                return `New visit added on route ${routeName}`;
            case 2:
                return `Visit removed from route ${routeName}`;
            case 3:
                return `Route updated: ${routeName}`;
            case 4:
                return `Visit order updated on route ${routeName}`;
            default:
                return `Route changed: ${routeName}`;
        }
    };

    const parseFieldIdentifiers = (fieldValue) => {
        if (!fieldValue && fieldValue !== 0) {
            return "No additional details";
        }

        const results = [];
        if (fieldValue & 1) results.push("Schedule updated");
        if (fieldValue & 2) results.push("Start time adjusted");
        if (fieldValue & 4) results.push("End time adjusted");
        if (fieldValue & 8) results.push("Pickup/Drop-off updated");
        if (fieldValue & 16) results.push("Priority changed");

        return results.length ? results.join(", ") : "Route details changed";
    };

    const handleDeleteNotification = async (id) => {
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                return;
            }

            await axios.delete(`${serverUrlApi}route-changes/${id}`, {
                headers: {
                    accept: "*/*",
                    Authorization: `Bearer ${accessToken}`
                }
            });
            setNotifications((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            console.log("handleDeleteNotification error:", error);
        }
    };

    const handleClearAll = async () => {
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                return;
            }

            await Promise.all(
                notifications.map((item) =>
                    axios.delete(`${serverUrlApi}route-changes/${item.id}`, {
                        headers: {
                            accept: "*/*",
                            Authorization: `Bearer ${accessToken}`
                        }
                    })
                )
            );
            setNotifications([]);
        } catch (error) {
            console.log("handleClearAll error:", error);
        }
    };

    const showBackButton = navigation?.canGoBack?.();

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <View style={styles.topPanel}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            {showBackButton && (
                                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                                    <Ionicons name="chevron-back" size={20} color={tokens.textSecondary} />
                                    <Text style={styles.backLabel}>Back</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={styles.headerTitle}>Notifications</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.markAllButton}
                            onPress={handleClearAll}
                            disabled={!notifications.length}
                        >
                            <Text style={styles.markAllLabel}>Clear all</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.unreadLabel}>
                        {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
                    </Text>
                </View>

                {/* <View style={styles.refreshRow}>
                    <TouchableOpacity style={styles.reloadButton} onPress={loadNotifications}>
                        <Ionicons
                            name="refresh"
                            size={18}
                            color={tokens.primary}
                            style={styles.reloadIcon}
                        />
                        <Text style={styles.reloadLabel}>Refresh</Text>
                    </TouchableOpacity>
                </View> */}

                {loading ? (
                    <ActivityIndicator size="large" color={tokens.primary} />
                ) : notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrapper}>
                            <Ionicons name="notifications-off-outline" size={28} color={tokens.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>You’re all caught up</Text>
                        <Text style={styles.emptyDescription}>
                            New route and visit updates will show up here. Keep an eye on this tab during your shift.
                        </Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {notifications.map((item) => {
                            const reasonMessage = getReasonMessage(item.reason, item.routeName);
                            const changesDescription = parseFieldIdentifiers(item.fieldIdentifiers);
                            const relativeTime = getRelativeTime(item.created);

                            return (
                                <View key={item.id} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{reasonMessage}</Text>
                                        <Text style={styles.timeSince}>{relativeTime}</Text>
                                    </View>

                                    {item.checkpointAddress ? (
                                        <Text style={styles.cardBodyText}>
                                            Address: {item.checkpointAddress}
                                        </Text>
                                    ) : null}

                                    {item.checkpointName ? (
                                        <Text style={styles.cardBodyText}>
                                            Checkpoint: {item.checkpointName}
                                        </Text>
                                    ) : null}

                                    <Text style={styles.cardBodyText}>{changesDescription}</Text>

                                    {/* <View style={styles.cardFooter}>
                                        <View style={styles.cardTimestampRow}>
                                            <Ionicons
                                                name="time-outline"
                                                size={16}
                                                color={tokens.textMuted}
                                                style={styles.cardTimestampIcon}
                                            />
                                            <Text style={styles.cardTimestamp}>{formatDateString(item.created)}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteNotification(item.id)}
                                            style={styles.deleteButton}
                                        >
                                            <Text style={styles.deleteLabel}>Remove</Text>
                                        </TouchableOpacity>
                                    </View> */}
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            <BottomNavigationMenu navigation={navigation} activeTab="Notifs" />
        </View>
    );
};

const NotificationsScreen = (props) => (
    <ThemeProvider>
        <NotificationsScreenContent {...props} />
    </ThemeProvider>
);

export default NotificationsScreen;
