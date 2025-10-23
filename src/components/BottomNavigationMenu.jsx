import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { serverUrlApi } from "../const/api";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";

const createStyles = ({ tokens, theme, spacing, radii, typography }) =>
    StyleSheet.create({
        container: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: tokens.navBackground,
            borderTopWidth: 1,
            borderTopColor: tokens.navBorder,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
            shadowColor: tokens.navShadow,
            shadowOpacity: theme === "dark" ? 0.28 : 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: -4 },
            elevation: theme === "dark" ? 20 : 12
        },
        tab: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.xs
        },
        iconWrapper: {
            position: "relative",
            justifyContent: "center",
            alignItems: "center"
        },
        tabLabel: {
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.medium,
            marginTop: spacing.xs
        },
        badgeContainer: {
            position: "absolute",
            top: -spacing.xs,
            right: -spacing.xs,
            minWidth: 18,
            height: 18,
            paddingHorizontal: spacing.xs,
            borderRadius: radii.pill,
            backgroundColor: tokens.badgeBackground,
            justifyContent: "center",
            alignItems: "center"
        },
        badgeText: {
            color: tokens.badgeText,
            fontSize: typography.sizes.micro,
            fontWeight: typography.weights.bold
        }
    });

const BottomNavigationMenuInner = ({ navigation, activeTab }) => {
    const { tokens, theme, spacing, radii, typography } = useDesignSystem();
    const styles = useMemo(
        () => createStyles({ tokens, theme, spacing, radii, typography }),
        [tokens, theme, spacing, radii, typography]
    );

    const [notificationCount, setNotificationCount] = useState(0);

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
                console.log("Notification count fetch error:", error);
            }
        };

        fetchNotificationCount();

        return () => {
            isMounted = false;
        };
    }, []);

    const tabs = [
        {
            id: "actions",
            label: "Notifs",
            icon: "notifications-outline",
            screen: "NotificationsScreen",
            badge: true,
            aliases: ["actions", "notifs", "notifications"]
        },
        {
            id: "map",
            label: "Map",
            icon: "pin-outline",
            screen: "MapPage",
            aliases: ["map"]
        },
        {
            id: "dashboard",
            label: "Home",
            icon: "home-outline",
            screen: "ActionListsPage",
            aliases: ["home", "dashboard"]
        },
        {
            id: "road",
            label: "Routes",
            icon: "trail-sign-outline",
            screen: "RoutesPage",
            aliases: ["route", "routes", "road"]
        },
        {
            id: "settings",
            label: "Settings",
            icon: "settings-outline",
            screen: "SettingsPage",
            aliases: ["settings"]
        }
    ];

    const activeLower = (activeTab || "").toLowerCase();
    const activeEntry =
        tabs.find((tab) => tab.id === activeLower || tab.aliases.includes(activeLower)) ?? tabs[0];

    return (
        <View style={styles.container}>
            {tabs.map((tab) => {
                const isActive = tab.id === activeEntry.id;
                const showBadge = tab.badge && notificationCount > 0;

                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={styles.tab}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate(tab.screen)}
                    >
                        <View style={styles.iconWrapper}>
                            <Ionicons
                                name={tab.icon}
                                size={24}
                                color={isActive ? tokens.navActive : tokens.navInactive}
                            />
                            {showBadge && (
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>
                                        {notificationCount > 99 ? "99+" : notificationCount}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Text
                            style={[
                                styles.tabLabel,
                                { color: isActive ? tokens.navActive : tokens.navInactive }
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const BottomNavigationMenu = (props) => (
    <ThemeProvider>
        <BottomNavigationMenuInner {...props} />
    </ThemeProvider>
);

export default BottomNavigationMenu;
