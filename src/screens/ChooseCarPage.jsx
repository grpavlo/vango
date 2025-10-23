import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomNavigationMenu from "../components/BottomNavigationMenu";
import BottomSheetSelect from "../components/SelectListCustom";
import UniversalModal from "../components/UniversalModal";
import { Fonts } from "../utils/tokens";
import * as SecureStore from "expo-secure-store";
import { serverUrlApi } from "../const/api";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";

const withAlpha = (hex, alpha) => {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const ChooseCarPageContent = ({ navigation, route }) => {
    const { idRoute, routeName = "" } = route.params || {};

    const [selectedItem, setSelectedItem] = useState(null);
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [modalVisible, setModalVisible] = useState(false);

    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);

    useEffect(() => {
        const fetchCars = async () => {
            try {
                const accessToken = await SecureStore.getItemAsync("accessToken");
                if (!accessToken) {
                    setErrorMessage("Authentication token is missing. Please log in again.");
                    setLoading(false);
                    return;
                }
                const response = await fetch(serverUrlApi + "cars", {
                    method: "GET",
                    headers: {
                        accept: "application/json",
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (response.status === 200) {
                    const data = await response.json();
                    const formattedCars = data.map((car) => ({
                        key: car.id,
                        value: car.id,
                        label: `${car.carBrandName} ${car.licensePlate}`,
                    }));
                    setCars(formattedCars);
                } else if (response.status === 401) {
                    setErrorMessage("Unauthorized access. Please log in again.");
                } else {
                    setErrorMessage("Failed to load vehicles.");
                }
            } catch (error) {
                setErrorMessage("An error occurred while fetching vehicles. Please try again.");
            }
            setLoading(false);
        };

        fetchCars();
    }, []);

    const handleSelect = (item) => {
        setErrorMessage("");
        setSelectedItem(item);
    };

    const handleAccept = () => {
        if (selectedItem && idRoute) {
            setModalVisible(true);
        } else {
            setErrorMessage("Select a vehicle before continuing.");
        }
    };

    const handleConfirm = async () => {
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                setErrorMessage("Authentication token is missing. Please log in again.");
                setModalVisible(false);
                return;
            }
            const response = await fetch(serverUrlApi + `routes/${idRoute}/set-car`, {
                method: "PATCH",
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(selectedItem.value),
            });
            if (response.status === 200) {
                setModalVisible(false);
                navigation.replace("RouteCheckpointsPage", { idRoute });
            } else if (response.status === 401) {
                setErrorMessage("Unauthorized access. Please log in again.");
            } else if (response.status === 404) {
                setErrorMessage("Route not found.");
            } else {
                setErrorMessage("Failed to assign the vehicle. Please try again.");
            }
        } catch (error) {
            setErrorMessage("An error occurred while assigning the vehicle. Please try again.");
        }
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    const headerTitle = "Select Vehicle";
    const subtitle = routeName
        ? `Assign the vehicle for "${routeName}".`
        : "Assign the vehicle you will use for this route.";

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View>
                    <View style={styles.headerRow}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={() => navigation.goBack()}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        <View style={styles.headerButtonPlaceholder} />
                    </View>
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                    {loading ? (
                        <View style={styles.loadingWrapper}>
                            <ActivityIndicator size="large" color={palette.primary} />
                        </View>
                    ) : (
                        <View style={styles.selectorCard}>
                            <Text style={styles.selectorLabel}>Vehicle</Text>
                            <BottomSheetSelect
                                data={cars}
                                onSelect={handleSelect}
                                placeholder="Select a vehicle"
                                selectedValue={selectedItem?.label}
                            />
                        </View>
                    )}
                </View>

                {!loading ? (
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            selectedItem ? styles.primaryButtonEnabled : styles.primaryButtonDisabled,
                        ]}
                        onPress={handleAccept}
                        disabled={!selectedItem}
                        activeOpacity={selectedItem ? 0.85 : 1}
                    >
                        <Text
                            style={[
                                styles.primaryButtonText,
                                !selectedItem && styles.primaryButtonTextDisabled,
                            ]}
                        >
                            Assign Vehicle
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
            <UniversalModal
                visible={modalVisible}
                title="Assign this vehicle?"
                description="This vehicle will be recorded for the route and shared with dispatch."
                confirmText="Assign"
                cancelText="Go back"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </View>
    );
};

const createPalette = (tokens) => ({
    background: tokens.background,
    card: tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || "#FFFFFF",
    destructive: tokens.destructive,
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
            paddingBottom: 32,
            justifyContent: "space-between",
        },
        headerRow: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
        },
        headerButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: withAlpha(palette.primary, "10"),
            alignItems: "center",
            justifyContent: "center",
        },
        headerButtonPlaceholder: {
            width: 36,
            height: 36,
        },
        headerTitle: {
            flex: 1,
            marginHorizontal: 16,
            fontSize: Fonts.f20,
            fontWeight: "700",
            color: palette.textPrimary,
            textAlign: "center",
        },
        headerSubtitle: {
            fontSize: Fonts.f12,
            color: withAlpha(palette.textPrimary, "70"),
            marginBottom: 20,
            textAlign: "center",
        },
        loadingWrapper: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: 40,
        },
        selectorCard: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.border,
            padding: 16,
            backgroundColor: palette.card,
            shadowColor: withAlpha(palette.textPrimary, "12"),
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
        },
        selectorLabel: {
            fontSize: Fonts.f12,
            color: withAlpha(palette.textPrimary, "70"),
            marginBottom: 12,
        },
        primaryButton: {
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 24,
        },
        primaryButtonEnabled: {
            backgroundColor: palette.primary,
            shadowColor: withAlpha(palette.primary, "40"),
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
        },
        primaryButtonDisabled: {
            backgroundColor: withAlpha(palette.primary, "18"),
        },
        primaryButtonText: {
            fontSize: Fonts.f16,
            fontWeight: "600",
            color: palette.primaryForeground,
        },
        primaryButtonTextDisabled: {
            color: withAlpha(palette.textPrimary, "50"),
        },
        errorText: {
            color: palette.destructive,
            fontSize: Fonts.f12,
            marginBottom: 16,
            textAlign: "center",
        },
    });

const ChooseCarPage = (props) => (
    <ThemeProvider>
        <ChooseCarPageContent {...props} />
    </ThemeProvider>
);

export default ChooseCarPage;

