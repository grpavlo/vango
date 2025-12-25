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
import * as SecureStore from "expo-secure-store";

import BottomNavigationMenu from "../components/BottomNavigationMenu";
import { ThemeProvider, useDesignSystem } from "../context/ThemeContext";
import { Fonts } from "../utils/tokens";
import { useAppAlert } from "../hooks/useAppAlert";
import { serverUrlApi } from "../const/api";
import { VISIT_ARRIVAL_CHECK_TYPE, VISIT_RESULT_ITEM_TYPE, finishVisit } from "../utils/visitApi";

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
    destructive: tokens.destructive || "#DC2626",
    destructiveForeground: tokens.destructiveForeground || "#FFFFFF",
});

const formatTimestamp = (timestamp) => {
    if (!timestamp) {
        return "";
    }
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
        return "";
    }
};

const ShipPageContent = ({ navigation, route, checkpointId: checkpointIdProp }) => {
    const { tokens, theme } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const insets = useSafeAreaInsets();
    const statusBarStyle = theme === "dark" ? "light" : "dark";
    const routeCheckpointId = route?.params?.checkpointId;
    const checkpointId = useMemo(
        () => checkpointIdProp ?? routeCheckpointId ?? null,
        [checkpointIdProp, routeCheckpointId]
    );
    const headerTitle = useMemo(
        () => (checkpointId ? `Ship (#${checkpointId})` : "Ship"),
        [checkpointId]
    );

    const { showAlert } = useAppAlert();
    const [permission, requestPermission] = useCameraPermissions();

    const [samples, setSamples] = useState([]);
    const [loadCounts, setLoadCounts] = useState({ samples: null, packages: null });
    const [loadingCounts, setLoadingCounts] = useState(false);
    const [countsError, setCountsError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerNotice, setScannerNotice] = useState(null);
    const [scannerError, setScannerError] = useState(null);

    const routeIdFromParams = route?.params?.idRoute ?? route?.params?.routeId ?? null;

    const scannerLockRef = useRef(false);
    const visitStartAttemptedRef = useRef(false);

    const hasSamples = samples.length > 0;
    const canSubmit = hasSamples && !isSubmitting;

    const resolveRouteId = useCallback(async () => {
        if (routeIdFromParams) {
            return routeIdFromParams;
        }
        const storedId = await SecureStore.getItemAsync("idRoute");
        return storedId || null;
    }, [routeIdFromParams]);

    const fetchLoadCounts = useCallback(async () => {
        setLoadingCounts(true);
        setCountsError(null);
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                throw new Error("AUTH_MISSING");
            }
            const effectiveRouteId = await resolveRouteId();
            const query = effectiveRouteId ? `?routeId=${encodeURIComponent(effectiveRouteId)}` : "";
            const response = await fetch(`${serverUrlApi}routes/me/samples/count${query}`, {
                method: "GET",
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                throw new Error("COUNT_FETCH_FAILED");
            }

            let payload = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (typeof payload === "number") {
                setLoadCounts({ samples: payload, packages: null });
                return;
            }

            if (payload && typeof payload === "object") {
                const sampleValue = [payload.samples, payload.samplesCount, payload.sampleCount].find(
                    (value) => typeof value === "number"
                );
                const packageValue = [payload.packages, payload.packagesCount, payload.packageCount].find(
                    (value) => typeof value === "number"
                );
                setLoadCounts({
                    samples: typeof sampleValue === "number" ? sampleValue : null,
                    packages: typeof packageValue === "number" ? packageValue : null,
                });
                return;
            }

            setLoadCounts({ samples: null, packages: null });
        } catch (error) {
            let message = "Unable to load counts.";
            if (error?.message === "AUTH_MISSING") {
                message = "Authentication token is missing.";
            }
            setCountsError(message);
            setLoadCounts({ samples: null, packages: null });
        } finally {
            setLoadingCounts(false);
        }
    }, [resolveRouteId]);

    const startVisit = useCallback(async () => {
        if (!checkpointId || visitStartAttemptedRef.current) {
            return;
        }
        visitStartAttemptedRef.current = true;
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                visitStartAttemptedRef.current = false;
                return;
            }
            const response = await fetch(`${serverUrlApi}visits/${checkpointId}/start`, {
                method: "PATCH",
                headers: {
                    accept: "*/*",
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                visitStartAttemptedRef.current = false;
            }
        } catch (error) {
            visitStartAttemptedRef.current = false;
        }
    }, [checkpointId]);

    useEffect(() => {
        visitStartAttemptedRef.current = false;
    }, [checkpointId]);

    useEffect(() => {
        startVisit();
    }, [startVisit]);

    useEffect(() => {
        fetchLoadCounts();
    }, [fetchLoadCounts]);

    useEffect(() => {
        if (!scannerVisible) {
            setScannerNotice(null);
            setScannerError(null);
            scannerLockRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            setScannerNotice("Align the barcode inside the frame to capture it.");
        }, 500);

        return () => clearTimeout(timer);
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

    const openScanner = useCallback(async () => {
        const granted = await ensureCameraPermission();
        if (!granted) {
            showAlert({
                title: "Camera Permission",
                message: "Camera access is required to scan samples for shipment.",
                variant: "warning",
            });
            return;
        }
        setScannerError(null);
        setScannerVisible(true);
    }, [ensureCameraPermission, showAlert]);

    const closeScanner = useCallback(() => {
        setScannerVisible(false);
        setScannerNotice(null);
        setScannerError(null);
    }, []);

    const normalizeCode = useCallback(
        (value) => (typeof value === "string" ? value.trim().toUpperCase() : ""),
        [],
    );

    const addSample = useCallback(
        (rawCode, { isManual = false } = {}) => {
            const code = normalizeCode(rawCode);
            if (!code) {
                setScannerError("Unable to read sample code. Try again.");
                return false;
            }

            const isDuplicate = samples.some((sample) => sample.code === code);
            if (isDuplicate) {
                setScannerError("Sample already scanned.");
                return false;
            }

            const nextSample = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                code,
                timestamp: new Date().toISOString(),
                isManual,
            };

            setSamples((prev) => [...prev, nextSample]);
            setScannerError(null);
            return true;
        },
        [normalizeCode, samples],
    );

    const fetchSampleHierarchy = useCallback(async (code) => {
        const accessToken = await SecureStore.getItemAsync("accessToken");
        if (!accessToken) {
            throw new Error("AUTH_MISSING");
        }

        const response = await fetch(`${serverUrlApi}samples/${encodeURIComponent(code)}/hierarchy`, {
            method: "GET",
            headers: {
                accept: "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const message = await response.text().catch(() => "HIERARCHY_REQUEST_FAILED");
            throw new Error(message || "HIERARCHY_REQUEST_FAILED");
        }

       
        const payload = await response.json().catch(() => null);
        return payload || {};
    }, []);

    const handleCodeCaptured = useCallback(
        async (rawCode) => {
            const code = normalizeCode(rawCode);
            if (!code) {
                setScannerError("Unable to read sample code. Try again.");
                return false;
            }

            const isDuplicate = samples.some((sample) => sample.code === code);
            if (isDuplicate) {
                setScannerError("Sample already scanned.");
                return false;
            }

            try {
                const hierarchy = await fetchSampleHierarchy(code);
                const sampleType = Number(hierarchy?.type);
                const isPriority = Boolean(hierarchy?.priority);

                if (sampleType === 2) {
                    setScannerError("You need to open the package and scan the sample");
                    return false;
                }

                const success = addSample(code, {
                    isManual: sampleType === 1 && isPriority,
                });

                if (success) {
                    closeScanner();
                    return true;
                }
            } catch (error) {
                if (error?.message === "AUTH_MISSING") {
                    setScannerError("Authentication token is missing.");
                } else {
                    console.log(error)
                    setScannerError("Sample verification failed. Please try again.");
                }
            }

            return false;
        },
        [addSample, closeScanner, fetchSampleHierarchy, normalizeCode, samples],
    );

    const handleBarcodeScanned = useCallback(
        async ({ data }) => {
            if (!scannerVisible || !data || scannerLockRef.current) {
                return;
            }

            scannerLockRef.current = true;
            const success = await handleCodeCaptured(data);

            if (!success) {
                setTimeout(() => {
                    scannerLockRef.current = false;
                }, 900);
            }
        },
        [scannerVisible, handleCodeCaptured],
    );

    const handleRemoveSample = useCallback((sampleId) => {
        setSamples((prev) => prev.filter((sample) => sample.id !== sampleId));
    }, []);

    const buildVisitItems = useCallback(
        () =>
            samples.map((sample) => ({
                type: VISIT_RESULT_ITEM_TYPE.Sample,
                code: sample.code,
            })),
        [samples],
    );

    const handleConfirmShipment = useCallback(async () => {
        if (!hasSamples || isSubmitting) {
            return;
        }
        if (!checkpointId) {
            showAlert({
                title: "Visit not found",
                message: "Unable to determine the visit id.",
                variant: "error",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const items = buildVisitItems();
             console.log({
                visitId: checkpointId,
                arrivalCheckType: VISIT_ARRIVAL_CHECK_TYPE.None,
                items,
                itemLinks: [],
            })

            await finishVisit({
                visitId: checkpointId,
                arrivalCheckType: VISIT_ARRIVAL_CHECK_TYPE.None,
                items,
                itemLinks: [],
            });

           
            setSamples([]);
            await fetchLoadCounts();
            showAlert({
                title: "Shipment recorded",
                message: "Visit finished successfully.",
                variant: "success",
                onConfirm: () => navigation.goBack(),
            });
        } catch (error) {
            let message = "Unable to finish this visit. Please try again.";
            if (error?.message === "AUTH_MISSING") {
                message = "Authentication token is missing.";
            }
            //console.log(error);
            
            showAlert({
                title: "Finish failed",
                message,
                variant: "error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [buildVisitItems, checkpointId, fetchLoadCounts, hasSamples, isSubmitting, navigation, showAlert]);

    return (
        <View style={styles.screen}>
            <StatusBar style={statusBarStyle} />
            {/* <View style={[styles.safeInset, { height: insets.top }]} /> */}

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{headerTitle}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 200 },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.loadBanner,
                        countsError && styles.loadBannerError,
                        loadingCounts && styles.loadBannerDisabled,
                    ]}
                    onPress={fetchLoadCounts}
                    disabled={loadingCounts}
                    activeOpacity={0.85}
                >
                    <Ionicons
                        name={countsError ? "alert-circle-outline" : "cube-outline"}
                        size={14}
                        color={countsError ? palette.destructive || palette.primary : palette.primary}
                        style={styles.loadBannerIcon}
                    />
                    <Text
                        style={[
                            styles.loadBannerText,
                            countsError && styles.loadBannerTextError,
                        ]}
                        numberOfLines={1}
                    >
                        {countsError
                            ? countsError
                            : `Your Load: ${
                                  loadingCounts
                                      ? "Refreshing..."
                                      : `${loadCounts.samples ?? "--"} samples`
                              }`}
                    </Text>
                </TouchableOpacity>

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Ionicons
                                name="scan-outline"
                                size={18}
                                color={palette.primary}
                                style={styles.sectionTitleIcon}
                            />
                            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                                Samples for Shipment
                            </Text>
                        </View>
                        <View style={styles.sectionBadge}>
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
                                    style={[styles.sampleRow, { borderColor: palette.border }]}
                                >
                                    <View style={styles.sampleInfo}>
                                        <View style={styles.sampleIcon}>
                                            <Ionicons
                                                name="document-text-outline"
                                                size={18}
                                                color={sample.isManual ? palette.destructive || palette.primary : palette.primary}
                                            />
                                        </View>
                                        <View style={styles.sampleTextBlock}>
                                            <Text
                                                style={[
                                                    styles.sampleCode,
                                                    { color: palette.textPrimary },
                                                    sample.isManual && styles.manualSampleText,
                                                ]}
                                            >
                                                {sample.code}
                                            </Text>
                                            <View style={styles.sampleMetaRow}>
                                                <Text
                                                    style={[
                                                        styles.sampleTimestamp,
                                                        { color: palette.textSecondary },
                                                        sample.isManual && styles.manualSampleText,
                                                    ]}
                                                >
                                                    Scanned at {formatTimestamp(sample.timestamp)}
                                                </Text>
                                                {sample.isManual ? (
                                                    <View
                                                        style={[
                                                            styles.manualBadge,
                                                            {
                                                                borderColor: palette.destructive || "#DC2626",
                                                                backgroundColor: withAlpha(
                                                                    palette.destructive || "#DC2626",
                                                                    "10",
                                                                ),
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.manualBadgeText,
                                                                { color: palette.destructive || "#DC2626" },
                                                            ]}
                                                        >
                                                            MANUAL
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.sampleRemove}
                                        onPress={() => handleRemoveSample(sample.id)}
                                    >
                                        <Ionicons
                                            name="close"
                                            size={18}
                                            color={palette.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View
                            style={[
                                styles.emptyState,
                                { borderColor: withAlpha(palette.textSecondary, "38") },
                            ]}
                        >
                            <Ionicons name="scan-outline" size={28} color={palette.textSecondary} />
                            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                                No samples scanned
                            </Text>
                            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                                Use "Scan Sample" to add samples for shipment
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
                    <Ionicons name="scan-outline" size={18} color={palette.primary} />
                    <Text style={[styles.scanButtonText, { color: palette.primary }]}>
                        Scan Sample
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.footerHint, { color: palette.textSecondary }]}>
                    Scan samples to prepare for shipment.
                </Text>
                <TouchableOpacity
                    style={[styles.confirmButton, !canSubmit && styles.confirmButtonDisabled]}
                    onPress={handleConfirmShipment}
                    disabled={!canSubmit}
                >
                    <Ionicons
                        name="cube-outline"
                        size={20}
                        color={
                            canSubmit
                                ? palette.primaryForeground
                                : withAlpha(palette.primaryForeground, "70")
                        }
                        style={styles.confirmIcon}
                    />
                    <Text
                        style={[
                            styles.confirmButtonText,
                            !canSubmit && styles.confirmButtonTextDisabled,
                        ]}
                    >
                        {isSubmitting ? "Submitting..." : "Confirm Shipment"}
                    </Text>
                </TouchableOpacity>
            </View>

            <BottomNavigationMenu navigation={navigation} activeTab="home" />

            <Modal
                visible={scannerVisible}
                animationType="fade"
                presentationStyle="overFullScreen"
                transparent
                onRequestClose={closeScanner}
            >
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>Scan Sample</Text>
                        <TouchableOpacity style={styles.scannerClose} onPress={closeScanner}>
                            <Ionicons name="close" size={20} color="#FFFFFF" />
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
                            <Ionicons name="warning-outline" size={18} color="#FFE5E5" />
                            <Text style={styles.scannerErrorText}>{scannerError}</Text>
                        </View>
                    ) : null}
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        safeInset: {
            backgroundColor: palette.card,
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
            backgroundColor: withAlpha(palette.muted, "60"),
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
            gap: 20,
        },
        noticeCard: {
            borderWidth: 1,
            borderRadius: 18,
            paddingVertical: 16,
            paddingHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: withAlpha(palette.primary, "12"),
            borderColor: withAlpha(palette.primary, "28"),
        },
        noticeIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(palette.primary, "22"),
        },
        noticeContent: {
            flex: 1,
        },
        noticeTitle: {
            fontSize: Fonts.f14,
            fontWeight: "700",
        },
        noticeSubtitle: {
            marginTop: 4,
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
        loadBanner: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha(palette.primary, "24"),
            backgroundColor: withAlpha(palette.primary, "10"),
            gap: 8,
        },
        loadBannerIcon: {
            marginRight: 2,
        },
        loadBannerText: {
            flex: 1,
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.primary,
        },
        loadBannerDisabled: {
            opacity: 0.8,
        },
        loadBannerError: {
            borderColor: withAlpha(palette.destructive || palette.primary, "32"),
            backgroundColor: withAlpha(palette.destructive || "#DC2626", "12"),
        },
        loadBannerTextError: {
            color: palette.destructive || palette.primary,
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
        },
        refreshButton: {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: withAlpha(palette.primary, "10"),
        },
        refreshButtonDisabled: {
            opacity: 0.7,
        },
        refreshButtonText: {
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.primary,
        },
        refreshButtonTextDisabled: {
            color: palette.textSecondary,
        },
        loadStatsRow: {
            flexDirection: "row",
            gap: 12,
        },
        loadStatPill: {
            flex: 1,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            paddingVertical: 12,
            paddingHorizontal: 14,
        },
        loadStatLabel: {
            fontSize: Fonts.f12,
            marginBottom: 4,
        },
        loadStatValue: {
            fontSize: Fonts.f18,
            fontWeight: "700",
        },
        countError: {
            fontSize: Fonts.f12,
            fontWeight: "600",
        },
        sectionBadge: {
            minWidth: 34,
            paddingHorizontal: 10,
            height: 26,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: withAlpha(palette.primary, "32"),
            backgroundColor: withAlpha(palette.primary, "10"),
        },
        sectionBadgeText: {
            fontSize: Fonts.f12,
            fontWeight: "700",
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
            backgroundColor: palette.card,
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
            backgroundColor: withAlpha(palette.primary, "14"),
        },
        sampleTextBlock: {
            flex: 1,
            gap: 4,
        },
        sampleCode: {
            fontSize: Fonts.f16,
            fontWeight: "600",
        },
        sampleTimestamp: {
            marginTop: 2,
            fontSize: Fonts.f12,
            fontWeight: "500",
        },
        sampleMetaRow: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 2,
            gap: 8,
        },
        manualSampleText: {
            color: palette.destructive || "#DC2626",
        },
        manualBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1,
        },
        manualBadgeText: {
            fontSize: Fonts.f10,
            fontWeight: "700",
            letterSpacing: 0.4,
        },
        sampleRemove: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(palette.muted, "60"),
            marginLeft: 12,
        },
        emptyState: {
            borderWidth: 1,
            borderStyle: "dashed",
            borderRadius: 16,
            paddingVertical: 28,
            paddingHorizontal: 16,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: withAlpha(palette.muted, "40"),
        },
        emptyTitle: {
            fontSize: Fonts.f14,
            fontWeight: "600",
        },
        emptySubtitle: {
            fontSize: Fonts.f12,
            textAlign: "center",
        },
        footer: {
            paddingHorizontal: 20,
            paddingTop: 16,
            backgroundColor: palette.background,
            borderTopWidth: 1,
            borderTopColor: palette.border,
            gap: 12,
        },
        scanButton: {
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            borderWidth: 1,
            borderColor: withAlpha(palette.primary, "36"),
            backgroundColor: withAlpha(palette.primary, "08"),
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
            top: 120,
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

const ShipPage = (props) => (
    <ThemeProvider>
        <ShipPageContent
            {...props}
            checkpointId={props?.route?.params?.checkpointId ?? null}
        />
    </ThemeProvider>
);

export default ShipPage;
