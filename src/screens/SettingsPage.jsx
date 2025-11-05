import {useEffect, useMemo, useState} from "react";
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import {serverUrlApi} from "../const/api";
import {ThemeProvider, useDesignSystem} from "../context/ThemeContext";
import {THEME_LABELS, THEME_OPTIONS} from "../utils/designSystem";
import { useAppAlert } from "../hooks/useAppAlert";

const gpsEnabled = true;

const createStyles = ({tokens, theme, typography, spacing, radii}) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: tokens.background
        },
        container: {
            flex: 1
        },
        scrollContent: {
            paddingHorizontal: spacing.base,
            paddingTop: spacing.base,
            paddingBottom: spacing.xxl
        },
        title: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary,
            marginBottom: spacing.base
        },
        card: {
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: spacing.base,
            marginBottom: spacing.base,
            shadowColor: tokens.navShadow,
            shadowOpacity: theme === "dark" ? 0.25 : 0.12,
            shadowRadius: theme === "dark" ? 18 : 12,
            shadowOffset: {width: 0, height: theme === "dark" ? 8 : 4},
            elevation: theme === "dark" ? 10 : 6
        },
        cardLast: {
            marginBottom: 0
        },
        profileHeader: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.base
        },
        avatar: {
            height: 64,
            width: 64,
            borderRadius: 32,
            backgroundColor: tokens.primary,
            justifyContent: "center",
            alignItems: "center"
        },
        avatarText: {
            color: tokens.primaryForeground,
            fontWeight: typography.weights.bold,
            fontSize: typography.sizes.title
        },
        profileInfo: {
            flex: 1,
            marginLeft: spacing.base
        },
        profileName: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.cardForeground
        },
        profileRole: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginTop: spacing.xs
        },
        divider: {
            height: 1,
            backgroundColor: tokens.border,
            marginBottom: spacing.base
        },
        infoGroup: {
            marginTop: spacing.xs
        },
        infoItem: {
            marginBottom: spacing.sm
        },
        infoItemLast: {
            marginBottom: 0
        },
        infoLabel: {
            fontSize: typography.sizes.caption,
            color: tokens.textLabel,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: spacing.xs
        },
        infoValue: {
            fontSize: typography.sizes.body,
            color: tokens.cardForeground
        },
        listItem: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.sm
        },
        listTextGroup: {
            flex: 1,
            marginRight: spacing.base
        },
        listTitle: {
            fontSize: typography.sizes.body,
            color: tokens.textPrimary,
            fontWeight: typography.weights.medium
        },
        listTitleDisabled: {
            fontSize: typography.sizes.body,
            color: tokens.textMuted,
            fontWeight: typography.weights.medium
        },
        listSubtitle: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginTop: spacing.xs
        },
        itemDivider: {
            height: 1,
            backgroundColor: tokens.border,
            marginVertical: spacing.sm
        },
        disabledItem: {
            opacity: theme === "dark" ? 0.5 : 0.6
        },
        sectionHeading: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary
        },
        sectionHelper: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary,
            marginTop: spacing.xs
        },
        fieldGroup: {
            marginTop: spacing.base
        },
        label: {
            fontSize: typography.sizes.label,
            color: tokens.textLabel,
            marginBottom: spacing.xs
        },
        input: {
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radii.md,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
            fontSize: typography.sizes.body,
            color: tokens.textPrimary,
            backgroundColor: tokens.inputBackground
        },
        primaryButton: {
            backgroundColor: tokens.primary,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.lg
        },
        primaryButtonText: {
            fontSize: typography.sizes.button,
            color: tokens.primaryForeground,
            fontWeight: typography.weights.semibold
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: tokens.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.xl
        },
        modalCard: {
            backgroundColor: tokens.cardBackground,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: tokens.outline,
            padding: spacing.xl,
            width: "100%",
            maxWidth: 360,
            shadowColor: tokens.modalShadow,
            shadowOpacity: theme === "dark" ? 0.4 : 0.25,
            shadowRadius: theme === "dark" ? 22 : 16,
            shadowOffset: {width: 0, height: 10},
            elevation: theme === "dark" ? 14 : 8
        },
        modalTitle: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: tokens.textPrimary,
            marginBottom: spacing.md
        },
        modalContent: {
            marginBottom: spacing.lg
        },
        modalRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm
        },
        modalRowLast: {
            marginBottom: 0
        },
        modalLabel: {
            fontSize: typography.sizes.label,
            color: tokens.textSecondary
        },
        modalValue: {
            fontSize: typography.sizes.label,
            color: tokens.cardForeground,
            fontWeight: typography.weights.medium
        },
        modalValueMonospace: {
            fontSize: typography.sizes.label,
            color: tokens.cardForeground,
            fontWeight: typography.weights.medium,
            fontFamily: Platform.select({
                ios: "Menlo",
                android: "monospace",
                default: "monospace"
            })
        },
        statusAvailable: {
            color: tokens.primary
        },
        themeList: {
            marginTop: spacing.sm
        },
        themeOption: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.base,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radii.md,
            marginBottom: spacing.sm,
            backgroundColor: tokens.cardBackground
        },
        themeOptionActive: {
            borderColor: tokens.primary,
            backgroundColor: theme === "dark" ? "rgba(76, 175, 80, 0.15)" : "#E8F5E9"
        },
        themeOptionLast: {
            marginBottom: 0
        },
        themeOptionText: {
            fontSize: typography.sizes.body,
            color: tokens.textPrimary
        },
        themeOptionTextActive: {
            color: tokens.primary,
            fontWeight: typography.weights.semibold
        },
        secondaryButton: {
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.mutedBackground
        },
        secondaryButtonText: {
            fontSize: typography.sizes.button,
            color: tokens.textPrimary,
            fontWeight: typography.weights.medium
        }
    });

const SettingsPageContent = ({navigation}) => {
    const {
        tokens,
        theme,
        preference,
        setThemePreference,
        typography,
        spacing,
        radii
    } = useDesignSystem();
    const { showAlert } = useAppAlert();

    const styles = useMemo(
        () => createStyles({tokens, theme, typography, spacing, radii}),
        [tokens, theme, typography, spacing, radii]
    );

    const [userData, setUserData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: ""
    });

    const [timeInterval, setTimeInterval] = useState("5000");
    const [savedLastSentTime, setSavedLastSentTime] = useState("5");
    const [distanceInterval, setDistanceInterval] = useState("10");

    const [isVehicleModalVisible, setIsVehicleModalVisible] = useState(false);
    const [isThemeModalVisible, setIsThemeModalVisible] = useState(false);

    const defaultVehicle = useMemo(
        () => ({
            make: "Ford",
            model: "Transit Connect",
            registration: "ABC-123",
            year: "2023",
            color: "White",
            vin: "WF0EXXGBXRC123456",
            odometer: "24,580 mi",
            status: "Available"
        }),
        []
    );

    useEffect(() => {
        (async () => {
            try {
                const accessToken = await SecureStore.getItemAsync("accessToken");
                if (accessToken) {
                    const resp = await fetch(serverUrlApi + "settings/me", {
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data?.user) {
                            setUserData({
                                firstName: data.user.firstName,
                                lastName: data.user.lastName,
                                email: data.user.email,
                                phone: data.user.phone
                            });
                        }
                    }
                }
            } catch (error) {
                console.log("Error fetching user data:", error);
            }
        })();

        (async () => {
            try {
                const savedTime = await SecureStore.getItemAsync("timeInterval");
                const savedLastSent = await SecureStore.getItemAsync("savedLastSentTime");
                const savedDistance = await SecureStore.getItemAsync("distanceInterval");
                if (savedTime) setTimeInterval(savedTime);
                if (savedDistance) setDistanceInterval(savedDistance);
                if (savedLastSent) setSavedLastSentTime(savedLastSent);
            } catch (error) {
                console.log("Error loading intervals:", error);
            }
        })();
    }, []);

    const handleSaveIntervals = async () => {
        try {
            await SecureStore.setItemAsync("timeInterval", timeInterval);
            await SecureStore.setItemAsync("savedLastSentTime", savedLastSentTime);
            await SecureStore.setItemAsync("distanceInterval", distanceInterval);
            showAlert({
                title: "Settings Saved",
                message: "Time and distance intervals have been stored successfully.",
                variant: "success",
            });
        } catch (error) {
            showAlert({
                title: "Save Failed",
                message: "We could not save your settings. Please try again.",
                variant: "error",
            });
        }
    };


    const handleSelectTheme = async (option) => {
        await setThemePreference(option);
        setIsThemeModalVisible(false);
    };

    const userInitials = useMemo(() => {
        const initials = [userData.firstName, userData.lastName]
            .filter(Boolean)
            .map((value) => value.trim()[0])
            .join("")
            .toUpperCase();
        return initials || "DR";
    }, [userData.firstName, userData.lastName]);

    const fullName = useMemo(() => {
        const names = [userData.firstName, userData.lastName].filter(Boolean);
        if (!names.length) {
            return "Driver";
        }
        return names.join(" ");
    }, [userData.firstName, userData.lastName]);

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Settings</Text>

                <View style={styles.card}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{userInitials}</Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{fullName}</Text>
                            <Text style={styles.profileRole}>Driver</Text>
                        </View>
                    </View>

                    <View style={styles.divider}/>

                    <View style={styles.infoGroup}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue}>{userData.email || "—"}</Text>
                        </View>
                        <View style={[styles.infoItem, styles.infoItemLast]}>
                            <Text style={styles.infoLabel}>Phone</Text>
                            <Text style={styles.infoValue}>{userData.phone || "—"}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => navigation.navigate("ChangePasswordPage")}
                        activeOpacity={0.7}
                    >
                        <View style={styles.listTextGroup}>
                            <Text style={styles.listTitle}>Change password</Text>
                            <Text style={styles.listSubtitle}>Update your login credentials</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={tokens.textMuted}/>
                    </TouchableOpacity>

                    <View style={styles.itemDivider}/>

                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setIsVehicleModalVisible(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.listTextGroup}>
                            <Text style={styles.listTitle}>Default vehicle info</Text>
                            <Text style={styles.listSubtitle}>Review your assigned vehicle</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={tokens.textMuted}/>
                    </TouchableOpacity>

                    <View style={styles.itemDivider}/>

                    <TouchableOpacity
                        style={styles.listItem}
                        onPress={() => setIsThemeModalVisible(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.listTextGroup}>
                            <Text style={styles.listTitle}>Theme</Text>
                            <Text style={styles.listSubtitle}>
                                Currently {THEME_LABELS[preference]}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={tokens.textMuted}/>
                    </TouchableOpacity>

                    <View style={styles.itemDivider}/>

                    <View style={[styles.listItem, styles.disabledItem]}>
                        <View style={styles.listTextGroup}>
                            <Text style={styles.listTitleDisabled}>GPS</Text>
                            <Text style={styles.listSubtitle}>Managed by your organization</Text>
                        </View>
                        <Switch
                            value={gpsEnabled}
                            disabled
                            trackColor={{false: tokens.switchTrackOff, true: tokens.primary}}
                            thumbColor={tokens.switchThumb}
                            ios_backgroundColor={tokens.switchTrackOff}
                        />
                    </View>
                </View>

                {/* Original GPS controls retained for functionality */}
                <View style={[styles.card, styles.cardLast]}>
                    <Text style={styles.sectionHeading}>GPS reporting</Text>
                    <Text style={styles.sectionHelper}>
                        Control how often your device sends location updates while on duty.
                    </Text>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Time interval (ms)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={timeInterval}
                            onChangeText={setTimeInterval}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Distance interval (m)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={distanceInterval}
                            onChangeText={setDistanceInterval}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Time interval to server (m)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={savedLastSentTime}
                            onChangeText={setSavedLastSentTime}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleSaveIntervals}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryButtonText}>Save GPS settings</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Settings"/>

            <Modal
                animationType="fade"
                transparent
                visible={isVehicleModalVisible}
                onRequestClose={() => setIsVehicleModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Default vehicle information</Text>

                        <View style={styles.modalContent}>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Make / Model / Year</Text>
                                <Text style={styles.modalValue}>
                                    {defaultVehicle.make} {defaultVehicle.model} {defaultVehicle.year}
                                </Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>License plate</Text>
                                <Text style={styles.modalValue}>{defaultVehicle.registration}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Color</Text>
                                <Text style={styles.modalValue}>{defaultVehicle.color}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>VIN</Text>
                                <Text style={styles.modalValueMonospace}>{defaultVehicle.vin}</Text>
                            </View>
                            <View style={styles.modalRow}>
                                <Text style={styles.modalLabel}>Odometer</Text>
                                <Text style={styles.modalValue}>{defaultVehicle.odometer}</Text>
                            </View>
                            <View style={[styles.modalRow, styles.modalRowLast]}>
                                <Text style={styles.modalLabel}>Status</Text>
                                <Text style={[styles.modalValue, styles.statusAvailable]}>
                                    {defaultVehicle.status}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => setIsVehicleModalVisible(false)}
                        >
                            <Text style={styles.primaryButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                animationType="fade"
                transparent
                visible={isThemeModalVisible}
                onRequestClose={() => setIsThemeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Choose theme</Text>

                        <View style={styles.themeList}>
                            {THEME_OPTIONS.map((option, index) => {
                                const isActive = preference === option;
                                return (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.themeOption,
                                            isActive && styles.themeOptionActive,
                                            index === THEME_OPTIONS.length - 1 && styles.themeOptionLast
                                        ]}
                                        onPress={() => handleSelectTheme(option)}
                                        activeOpacity={0.8}
                                    >
                                        <Text
                                            style={[
                                                styles.themeOptionText,
                                                isActive && styles.themeOptionTextActive
                                            ]}
                                        >
                                            {THEME_LABELS[option]}
                                        </Text>
                                        {isActive && (
                                            <Ionicons name="checkmark-circle" size={20} color={tokens.primary}/>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setIsThemeModalVisible(false)}
                        >
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const SettingsPage = (props) => (
    <ThemeProvider>
        <SettingsPageContent {...props} />
    </ThemeProvider>
);

export default SettingsPage;
