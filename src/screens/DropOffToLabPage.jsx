import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import { Fonts } from "../utils/tokens";
import UniversalModal from "../components/UniversalModal";
import { useAppAlert } from "../hooks/useAppAlert";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const withAlpha = (hex, alpha) => {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const createPalette = (tokens) => ({
    background: tokens.background,
    card: tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    muted: tokens.mutedBackground || tokens.cardBackground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || "#FFFFFF",
    destructive: tokens.destructive,
    destructiveForeground: tokens.destructiveForeground || "#FFFFFF",
});

const formatTimeLabel = (timestamp) => {
    if (!timestamp) {
        return "";
    }
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
        return "";
    }
};

const DropOffToLabPageContent = ({ navigation }) => {
    const { tokens, theme } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const insets = useSafeAreaInsets();
    const statusBarStyle = theme === "dark" ? "light" : "dark";

    const { showAlert } = useAppAlert();

    const [permission, requestPermission] = useCameraPermissions();

    const [samples, setSamples] = useState([]);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerNotice, setScannerNotice] = useState(null);
    const [scannerError, setScannerError] = useState(null);
    const [pendingRemovalSample, setPendingRemovalSample] = useState(null);

    const scannerLockRef = useRef(false);

    const hasSamples = samples.length > 0;

    useEffect(() => {
        let noticeTimer;

        if (scannerVisible) {
            noticeTimer = setTimeout(() => {
                setScannerNotice("Align the barcode inside the frame to capture it.");
            }, 500);
        } else {
            setScannerNotice(null);
            setScannerError(null);
        }

        return () => {
            if (noticeTimer) {
                clearTimeout(noticeTimer);
            }
        };
    }, [scannerVisible]);

    useEffect(() => {
        if (!scannerError) {
            return;
        }
        const timeout = setTimeout(() => setScannerError(null), 2200);
        return () => clearTimeout(timeout);
    }, [scannerError]);

    const ensureCameraPermission = useCallback(async () => {
        if (!permission) {
            const { status } = await requestPermission();
            return status === "granted";
        }
        if (!permission.granted) {
            const { status } = await requestPermission();
            return status === "granted";
        }
        return true;
    }, [permission, requestPermission]);

    const openScanner = useCallback(
        async () => {
            const granted = await ensureCameraPermission();
            if (!granted) {
                showAlert({
                    title: "Camera Permission",
                    message: "Camera access is required to scan samples for drop-off.",
                    variant: "warning",
                });
                return;
            }
            setScannerVisible(true);
        },
        [ensureCameraPermission, showAlert],
    );

    const closeScanner = useCallback(() => {
        setScannerVisible(false);
        setScannerNotice(null);
        setScannerError(null);
        scannerLockRef.current = false;
    }, []);

    const handleCodeCaptured = useCallback(
        (rawCode) => {
            const code = (
                typeof rawCode === "string" ? rawCode : `${rawCode ?? ""}`
            )
                .trim()
                .toLowerCase();
            if (!code) {
                setScannerError("Unable to read sample code. Try again.");
                return false;
            }

            const isDuplicate = samples.some((sample) => sample.id === code);
            if (isDuplicate) {
                setScannerError("Sample already scanned. Check the label and try again.");
                return false;
            }

            setSamples((prev) => [...prev, { id: code, scannedAt: Date.now() }]);
            setScannerError(null);
            return true;
        },
        [samples],
    );

    const handleBarcodeScanned = useCallback(
        ({ data }) => {
            if (!scannerVisible || !data || scannerLockRef.current) {
                return;
            }

            scannerLockRef.current = true;
            setTimeout(() => {
                scannerLockRef.current = false;
            }, 600);

            const success = handleCodeCaptured(data);
            if (success) {
                closeScanner();
            }
        },
        [scannerVisible, handleCodeCaptured, closeScanner],
    );

    const handleRemoveSample = useCallback((sample) => {
        setPendingRemovalSample(sample);
    }, []);

    const confirmRemoval = useCallback(() => {
        if (!pendingRemovalSample) {
            return;
        }
        setSamples((prev) => prev.filter((item) => item.id !== pendingRemovalSample.id));
        setPendingRemovalSample(null);
    }, [pendingRemovalSample]);

    const cancelRemoval = useCallback(() => setPendingRemovalSample(null), []);

    const handleConfirmDropOff = useCallback(() => {
        if (!hasSamples) {
            return;
        }
        setScannerError(null);
        setSamples([]);
        navigation.goBack();
    }, [hasSamples, navigation]);

    return (
        <View style={styles.screen}>
            <StatusBar style={statusBarStyle} />
            {/* <View style={[styles.safeInset, { height: insets.top }]} /> */}

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Drop Off to Lab</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View
                    style={[
                        styles.noticeCard,
                        {
                            borderColor: withAlpha(palette.destructive, "80"),
                            backgroundColor: withAlpha(palette.destructive, "12"),
                        },
                    ]}
                >
                    <Ionicons name="warning-outline" size={20} color={palette.destructive} />
                    <View style={styles.noticeContent}>
                        <Text style={[styles.noticeTitle, { color: palette.destructive }]}>
                            STAT Notice
                        </Text>
                        <Text style={[styles.noticeMessage, { color: palette.destructive }]}>
                            "STAT: hand directly to lab tech — no drop-off."
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons
                                name="flask-outline"
                                size={18}
                                color={palette.primary}
                                style={styles.sectionTitleIcon}
                            />
                            <Text style={styles.sectionTitle}>Samples for Lab Drop-off</Text>
                        </View>
                        <View
                            style={[
                                styles.sectionBadge,
                                {
                                    backgroundColor: withAlpha(palette.primary, "18"),
                                    borderColor: withAlpha(palette.primary, "40"),
                                },
                            ]}
                        >
                            <Text style={[styles.sectionBadgeText, { color: palette.primary }]}>
                                {samples.length}
                            </Text>
                        </View>
                    </View>

                    {hasSamples ? (
                        <View style={styles.samplesList}>
                            {samples.map((sample) => (
                                <View
                                    key={sample.id}
                                    style={[
                                        styles.sampleRow,
                                        { borderColor: withAlpha(palette.border, "80") },
                                    ]}
                                >
                                    <View style={styles.sampleInfo}>
                                        <View
                                            style={[
                                                styles.sampleIcon,
                                                { backgroundColor: withAlpha(palette.primary, "15") },
                                            ]}
                                        >
                                            <Ionicons
                                                name="barcode-outline"
                                                size={18}
                                                color={palette.primary}
                                            />
                                        </View>
                                        <View>
                                            <Text style={[styles.sampleCode, { color: palette.textPrimary }]}>
                                                {sample.id}
                                            </Text>
                                            <Text style={[styles.sampleMeta, { color: palette.textSecondary }]}>
                                                Scanned at {formatTimeLabel(sample.scannedAt)}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveSample(sample)}
                                        style={styles.removeButton}
                                    >
                                        <Ionicons
                                            name="trash-outline"
                                            size={18}
                                            color={palette.destructive}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <EmptyState
                            palette={palette}
                            icon="scan-outline"
                            title="No samples scanned"
                            subtitle='Use "Scan Sample" to add samples for lab drop-off'
                        />
                    )}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
                <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
                    <Ionicons name="scan-outline" size={18} color={palette.primary} />
                    <Text style={[styles.scanButtonText, { color: palette.primary }]}>
                        Scan Sample
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.footerHint, { color: palette.textSecondary }]}>
                    Scan samples to prepare for lab drop-off.
                </Text>
                <TouchableOpacity
                    style={[styles.confirmButton, !hasSamples && styles.confirmButtonDisabled]}
                    onPress={handleConfirmDropOff}
                    disabled={!hasSamples}
                >
                    <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color={hasSamples ? palette.primaryForeground : withAlpha(palette.primaryForeground, "70")}
                        style={styles.confirmIcon}
                    />
                    <Text
                        style={[
                            styles.confirmButtonText,
                            !hasSamples && styles.confirmButtonTextDisabled,
                        ]}
                    >
                        Confirm Drop-Off to Lab
                    </Text>
                </TouchableOpacity>
            </View>

            <BottomNavigationMenu
                navigation={navigation}
                activeTab="home"
                selectedTab="home"
            />

            <Modal visible={scannerVisible} transparent animationType="fade" onRequestClose={closeScanner}>
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan Sample</Text>
                        <TouchableOpacity style={styles.scannerClose} onPress={closeScanner}>
                            <Ionicons name="close" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={handleBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "upc_a", "upc_e"],
                        }}
                    />
                    <View style={styles.scannerFooter}>
                        {scannerNotice ? <Text style={styles.scannerNotice}>{scannerNotice}</Text> : null}
                    </View>

                    {scannerError ? (
                        <View style={styles.scannerError}>
                            <Ionicons name="alert-circle-outline" size={18} color="#FFE5E5" />
                            <Text style={styles.scannerErrorText}>{scannerError}</Text>
                        </View>
                    ) : null}
                </View>
            </Modal>

            <UniversalModal
                visible={!!pendingRemovalSample}
                title="Remove sample?"
                description="Removing this sample will exclude it from the lab drop-off list."
                confirmText="Remove"
                cancelText="Cancel"
                onCancel={cancelRemoval}
                onConfirm={confirmRemoval}
                variant="destructive"
            />
        </View>
    );
};

const EmptyState = ({ palette, icon, title, subtitle }) => (
    <View
        style={[
            stylesEmpty.container,
            {
                borderColor: withAlpha(palette.border, "60"),
                backgroundColor: withAlpha(palette.muted, "18"),
            },
        ]}
    >
        <Ionicons name={icon} size={28} color={palette.textSecondary} style={{ marginBottom: 10 }} />
        <Text style={[stylesEmpty.title, { color: palette.textPrimary }]}>{title}</Text>
        <Text style={[stylesEmpty.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
    </View>
);

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        safeInset: {
            backgroundColor: palette.background,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            backgroundColor: palette.card,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(palette.muted, "70"),
        },
        headerTitle: {
            flex: 1,
            marginLeft: 12,
            fontSize: Fonts.f18,
            fontWeight: "700",
            color: palette.textPrimary,
        },
        headerSpacer: {
            width: 40,
            height: 40,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 200,
            gap: 20,
        },
        noticeCard: {
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
        },
        noticeContent: {
            flex: 1,
        },
        noticeTitle: {
            fontSize: Fonts.f14,
            fontWeight: "700",
            marginBottom: 4,
        },
        noticeMessage: {
            fontSize: Fonts.f12,
            fontWeight: "500",
        },
        sectionCard: {
            borderWidth: 1,
            borderRadius: 18,
            borderColor: palette.border,
            backgroundColor: palette.card,
            padding: 18,
            gap: 18,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        sectionTitleRow: {
            flexDirection: "row",
            alignItems: "center",
        },
        sectionTitleIcon: {
            marginRight: 8,
        },
        sectionTitle: {
            fontSize: Fonts.f16,
            fontWeight: "600",
            color: palette.textPrimary,
        },
        sectionBadge: {
            minWidth: 34,
            paddingHorizontal: 10,
            height: 26,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
        },
        sectionBadgeText: {
            fontSize: Fonts.f12,
            fontWeight: "600",
        },
        samplesList: {
            gap: 12,
        },
        sampleRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderRadius: 16,
            backgroundColor: withAlpha(palette.card, "FF"),
        },
        sampleInfo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            flex: 1,
        },
        sampleIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        sampleCode: {
            fontSize: Fonts.f14,
            fontWeight: "600",
        },
        sampleMeta: {
            fontSize: Fonts.f12,
            marginTop: 2,
        },
        removeButton: {
            padding: 6,
        },
        footer: {
            paddingHorizontal: 20,
            paddingTop: 16,
            backgroundColor: palette.background,
            gap: 10,
        },
        scanButton: {
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            backgroundColor: withAlpha(palette.primary, "12"),
        },
        scanButtonText: {
            fontSize: Fonts.f16,
            fontWeight: "600",
        },
        footerHint: {
            fontSize: Fonts.f12,
            textAlign: "center",
        },
        confirmButton: {
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.primary,
            flexDirection: "row",
            gap: 8,
        },
        confirmButtonDisabled: {
            backgroundColor: withAlpha(palette.primary, "30"),
        },
        confirmButtonText: {
            fontSize: Fonts.f16,
            fontWeight: "700",
            color: palette.primaryForeground,
        },
        confirmButtonTextDisabled: {
            color: withAlpha(palette.primaryForeground, "70"),
        },
        confirmIcon: {
            marginRight: 2,
        },
        scannerOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            justifyContent: "center",
            alignItems: "center",
        },
        scannerHeader: {
            position: "absolute",
            top: 60,
            left: 24,
            right: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        scannerTitle: {
            fontSize: Fonts.f18,
            fontWeight: "700",
            color: "#FFFFFF",
        },
        scannerClose: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.4)",
        },
        camera: {
            width: windowWidth * 0.85,
            height: windowHeight * 0.55,
            borderRadius: 20,
            overflow: "hidden",
        },
        scannerFooter: {
            width: windowWidth * 0.85,
            marginTop: 20,
            alignItems: "center",
        },
        scannerNotice: {
            fontSize: Fonts.f12,
            color: withAlpha("#FFFFFF", "90"),
            textAlign: "center",
        },
        scannerError: {
            position: "absolute",
            top: 130,
            left: 30,
            right: 30,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: "rgba(220,53,69,0.92)",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        scannerErrorText: {
            flex: 1,
            fontSize: Fonts.f12,
            color: "#FFE5E5",
        },
    });

const stylesEmpty = StyleSheet.create({
    container: {
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 16,
        paddingVertical: 26,
        paddingHorizontal: 16,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 6,
    },
    title: {
        fontSize: Fonts.f14,
        fontWeight: "600",
    },
    subtitle: {
        fontSize: Fonts.f12,
        textAlign: "center",
    },
});

const DropOffToLabPage = (props) => (
    <ThemeProvider>
        <DropOffToLabPageContent {...props} />
    </ThemeProvider>
);

export default DropOffToLabPage;
