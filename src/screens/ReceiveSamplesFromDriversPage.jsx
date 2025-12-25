import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import UniversalModal from "../components/UniversalModal";
import { useAppAlert } from "../hooks/useAppAlert";
import { serverUrlApi } from "../const/api";
import { VISIT_RESULT_ITEM_TYPE } from "../utils/visitApi";

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

const buildPackageName = (index) => `Package ${index}`;

const ReceiveSamplesFromDriversPageContent = ({ navigation }) => {
    const { tokens, theme } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const insets = useSafeAreaInsets();
    const statusBarStyle = theme === "dark" ? "light" : "dark";

    const { showAlert } = useAppAlert();
    const [permission, requestPermission] = useCameraPermissions();

    const [packages, setPackages] = useState([]);
    const [unassignedSamples, setUnassignedSamples] = useState([]);
    const [selectedSamples, setSelectedSamples] = useState([]);
    const [activePackageId, setActivePackageId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState(null);
    const [scannerNotice, setScannerNotice] = useState(null);
    const [pendingPackageRemoval, setPendingPackageRemoval] = useState(undefined);
    const [scannerError, setScannerError] = useState(null);

    const hasPackages = packages.length > 0;
    const hasAssignedSamples = packages.some((pkg) => pkg.samples.length > 0);
    const hasUnassignedSamples = unassignedSamples.length > 0;
    const canConfirmPickup = hasPackages || hasAssignedSamples || hasUnassignedSamples;
    const confirmDisabled = !canConfirmPickup || isSubmitting;

    const statusMessage = useMemo(() => {
        if (isSubmitting) {
            return "Submitting pick-up...";
        }
        if (!canConfirmPickup) {
            return "Scan a package or sample to enable confirmation.";
        }
        return "Ready to confirm pick-up.";
    }, [canConfirmPickup, isSubmitting]);

    const setActivePackage = useCallback((packageId) => {
        setActivePackageId((prevActiveId) => {
            const nextActiveId = prevActiveId === packageId ? null : packageId;
            setPackages((prevPackages) =>
                prevPackages.map((pkg) => ({
                    ...pkg,
                    isActive: nextActiveId ? pkg.id === nextActiveId : false,
                })),
            );
            return nextActiveId;
        });
    }, []);

    useEffect(() => {
        if (!scannerVisible) {
            setScannerNotice(null);
            return;
        }

        const timer = setTimeout(() => {
            if (scannerMode === "package") {
                setScannerNotice("Point the camera at the package label");
            } else if (scannerMode === "sample") {
                setScannerNotice("Scan the sample barcode");
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [scannerVisible, scannerMode]);

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

    const closeScanner = useCallback(() => {
        setScannerVisible(false);
        setScannerMode(null);
        setScannerError(null);
    }, []);

    const openScanner = useCallback(
        async (mode) => {
            const granted = await ensureCameraPermission();
            if (!granted) {
                showAlert({
                    title: "Camera Permission Needed",
                    message: "Allow camera access to scan packages and samples.",
                    variant: "warning",
                });
                return;
            }
            setScannerError(null);
            setScannerMode(mode);
            setScannerVisible(true);
        },
        [ensureCameraPermission, showAlert],
    );

    const normalizeCode = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

    const addPackage = useCallback(
        (rawCode) => {
            const barcode = normalizeCode(rawCode);
            if (!barcode) {
                setScannerError("Unable to read package code. Try again.");
                return false;
            }

            const exists =
                packages.some((pkg) => pkg.barcode === barcode) ||
                unassignedSamples.some((sample) => sample.code === barcode);
            if (exists) {
                setScannerError("Package already scanned.");
                return false;
            }

            const nextPackage = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                barcode,
                name: buildPackageName(packages.length + 1),
                isActive: false,
                samples: [],
            };

            setPackages((prev) => [...prev, nextPackage]);

            return true;
        },
        [packages, setScannerError, unassignedSamples],
    );

    const addSample = useCallback(
        (rawCode) => {
            const code = normalizeCode(rawCode);
            if (!code) {
                setScannerError("Unable to read sample code. Try again.");
                return false;
            }

            const duplicate =
                unassignedSamples.some((sample) => sample.code === code) ||
                packages.some((pkg) => pkg.samples.some((sample) => sample.code === code));

            if (duplicate) {
                setScannerError("Sample already scanned.");
                return false;
            }

            const sample = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                code,
                timestamp: new Date(),
            };

            setUnassignedSamples((prev) => [...prev, sample]);

            return true;
        },
        [
            packages,
            setScannerError,
            unassignedSamples,
        ],
    );

    const handleCodeCaptured = useCallback(
        (code) => {
            if (!code) {
                setScannerError("Unable to read code. Try again.");
                return;
            }
            setScannerError(null);
            const action = scannerMode === "package" ? addPackage : addSample;
            const success = action(code);
            if (success) {
                closeScanner();
            }
        },
        [addPackage, addSample, closeScanner, scannerMode, setScannerError],
    );

    const handleBarcodeScanned = ({ data }) => {
        if (!scannerVisible || !data) {
            return;
        }
        handleCodeCaptured(data);
    };

    const toggleSampleSelection = useCallback((sampleId) => {
        setSelectedSamples((prev) =>
            prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId],
        );
    }, []);

    const removeUnassignedSample = useCallback((sampleId) => {
        setUnassignedSamples((prev) => prev.filter((sample) => sample.id !== sampleId));
        setSelectedSamples((prev) => prev.filter((id) => id !== sampleId));
    }, []);

    const removeSampleFromPackage = useCallback((packageId, sampleId) => {
        let removedSample = null;
        setPackages((prev) =>
            prev.map((pkg) => {
                if (pkg.id !== packageId) {
                    return pkg;
                }
                const filtered = pkg.samples.filter((sample) => {
                    if (sample.id === sampleId) {
                        removedSample = sample;
                        return false;
                    }
                    return true;
                });
                return { ...pkg, samples: filtered };
            }),
        );
        if (removedSample) {
            setUnassignedSamples((prev) => [...prev, removedSample]);
        }
    }, []);

    const assignSelectedToPackage = useCallback(
        (packageId) => {
            if (!selectedSamples.length) {
                showAlert({
                    title: "Select Samples",
                    message: "Tap samples to highlight them before assigning.",
                    variant: "info",
                });
                return;
            }

            const selected = new Set(selectedSamples);
            let movedSamples = [];

            setUnassignedSamples((prev) => {
                const remaining = [];
                prev.forEach((sample) => {
                    if (selected.has(sample.id)) {
                        movedSamples.push(sample);
                    } else {
                        remaining.push(sample);
                    }
                });
                return remaining;
            });

            if (!movedSamples.length) {
                return;
            }

            setPackages((prev) =>
                prev.map((pkg) =>
                    pkg.id === packageId
                        ? { ...pkg, samples: [...pkg.samples, ...movedSamples] }
                        : pkg,
                ),
            );
            setSelectedSamples([]);

            const packageName = packages.find((pkg) => pkg.id === packageId)?.name || "Package";
            showAlert({
                title: "Samples Assigned",
                message: `${movedSamples.length} sample(s) linked to ${packageName}.`,
                variant: "success",
            });
        },
        [packages, selectedSamples, showAlert],
    );

    const requestPackageRemoval = useCallback((packageId) => {
        setPendingPackageRemoval(packageId);
    }, []);

    const confirmPackageRemoval = useCallback(() => {
        if (!pendingPackageRemoval) {
            return;
        }
        let returningSamples = [];
        let nextActiveId = activePackageId;

        const updatedPackages = packages.filter((pkg) => {
            if (pkg.id !== pendingPackageRemoval) {
                return true;
            }
            returningSamples = pkg.samples;
            return false;
        });

        if (returningSamples.length) {
            setUnassignedSamples((prev) => [...prev, ...returningSamples]);
        }

        if (activePackageId === pendingPackageRemoval) {
            nextActiveId = null;
        }

        setPackages(
            updatedPackages.map((pkg) => ({
                ...pkg,
                isActive: nextActiveId ? pkg.id === nextActiveId : false,
            })),
        );
        setActivePackageId(nextActiveId);
        setPendingPackageRemoval(null);

    }, [activePackageId, packages, pendingPackageRemoval, showAlert]);

    const buildDriverPickupPayload = useCallback(() => {
        const packageItems = [];
        const sampleItems = [];
        const itemLinks = [];
        const seenSamples = new Set();

        packages.forEach((pkg) => {
            if (pkg?.barcode) {
                packageItems.push({
                    type: VISIT_RESULT_ITEM_TYPE.Package,
                    code: pkg.barcode,
                });
            }
            (pkg?.samples || []).forEach((sample) => {
                if (pkg?.barcode && sample?.code) {
                    itemLinks.push({
                        parentCode: pkg.barcode,
                        childCode: sample.code,
                    });
                }
                if (sample?.code && !seenSamples.has(sample.code)) {
                    sampleItems.push({
                        type: VISIT_RESULT_ITEM_TYPE.Sample,
                        code: sample.code,
                    });
                    seenSamples.add(sample.code);
                }
            });
        });

        unassignedSamples.forEach((sample) => {
            if (sample?.code && !seenSamples.has(sample.code)) {
                sampleItems.push({
                    type: VISIT_RESULT_ITEM_TYPE.Sample,
                    code: sample.code,
                });
                seenSamples.add(sample.code);
            }
        });

        return {
            items: [...packageItems, ...sampleItems],
            itemLinks,
        };
    }, [packages, unassignedSamples]);

    const handleConfirmPickup = useCallback(async () => {
        if (!canConfirmPickup || isSubmitting) {
            return;
        }

        const { items, itemLinks } = buildDriverPickupPayload();

        setIsSubmitting(true);
        try {
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) {
                throw new Error("AUTH_MISSING");
            }

            const response = await fetch(`${serverUrlApi}samples/driver-pickup`, {
                method: "PATCH",
                headers: {
                    accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    items,
                    itemLinks,
                }),
            });

            if (!response.ok) {
                if (response.status === 400) {
                    throw new Error("BARCODE_NOT_FOUND");
                }
                const message = await response.text().catch(() => "");
                const code = typeof message === "string" && message.trim() ? message.trim() : null;
                throw new Error(code || `HTTP_${response.status}`);
            }

            showAlert({
                title: "Pick-Up Confirmed",
                message: "Driver handoff recorded successfully.",
                variant: "success",
                onConfirm: () => navigation.goBack(),
            });
        } catch (error) {
            let message = "Unable to record the driver pick-up. Please try again.";
            if (error?.message === "AUTH_MISSING") {
                message = "Authentication token is missing. Please log in again.";
            } else if (error?.message === "BARCODE_NOT_FOUND") {
                message = "Barcode not found. Please verify and try again.";
            } else if (error?.message === "HTTP_401" || error?.message === "HTTP_403") {
                message = "Session expired. Please log in again.";
            } else if (error?.message && !error.message.startsWith("HTTP_")) {
                message = error.message;
            }
            showAlert({
                title: "Error",
                message,
                variant: "error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }, [buildDriverPickupPayload, canConfirmPickup, isSubmitting, navigation, showAlert]);

    return (
        <View style={styles.screen}>
            <StatusBar style={statusBarStyle} />
            {insets.top > 0 ? (
                <View
                    pointerEvents="none"
                    style={[styles.safeInset, { height: insets.top }]}
                />
            ) : null}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Receive Samples from Drivers </Text>
                <View style={styles.headerSpacer} />
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Packages</Text>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={() => openScanner("package")}
                        >
                            <Ionicons name="qr-code-outline" size={18} color={palette.primaryForeground} />
                            <Text style={styles.scanButtonText}>Scan Packages</Text>
                        </TouchableOpacity>
                    </View>

                    {packages.length === 0 ? (
                        <EmptyState
                            palette={palette}
                            icon="cube-outline"
                            title="No packages scanned yet"
                            subtitle='Use "Scan Packages" to add'
                        />
                    ) : (
                        packages.map((pkg) => (
                            <View
                                key={pkg.id}
                                style={[
                                    styles.packageCard,
                                    pkg.isActive && styles.packageCardActive,
                                ]}
                            >
                                <View style={styles.packageHeader}>
                                    <View>
                                        <Text style={styles.packageName}>{pkg.name}</Text>
                                        <Text style={styles.packageBarcode}>{pkg.barcode}</Text>
                                    </View>
                                    <View style={styles.packageActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.packageActionButton,
                                                pkg.isActive && styles.packageActionButtonActive,
                                            ]}
                                            onPress={() => setActivePackage(pkg.id)}
                                        >
                                            <Ionicons
                                                name={
                                                    pkg.isActive
                                                        ? "radio-button-on-outline"
                                                        : "radio-button-off-outline"
                                                }
                                                size={16}
                                                color={pkg.isActive ? palette.primary : palette.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.packageActionText,
                                                    pkg.isActive && styles.packageActionTextActive,
                                                ]}
                                            >
                                                {pkg.isActive ? "Deactivate" : "Set Active"}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.packageRemoveButton}
                                            onPress={() => requestPackageRemoval(pkg.id)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={palette.destructive} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={styles.packageBody}>
                                    <Text style={styles.packageCount}>
                                        {pkg.samples.length} sample{pkg.samples.length === 1 ? "" : "s"}
                                    </Text>
                                    {pkg.samples.length === 0 ? (
                                        <Text style={styles.packageHint}>No samples assigned yet.</Text>
                                    ) : (
                                        <View style={styles.sampleChipList}>
                                            {pkg.samples.map((sample) => (
                                                <View key={sample.id} style={styles.sampleChip}>
                                                    <Text style={styles.sampleChipText}>{sample.code}</Text>
                                                    <TouchableOpacity
                                                        onPress={() => removeSampleFromPackage(pkg.id, sample.id)}
                                                    >
                                                        <Ionicons
                                                            name="close-outline"
                                                            size={16}
                                                            color={palette.destructive}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.assignButton,
                                        selectedSamples.length === 0 && styles.assignButtonDisabled,
                                    ]}
                                    disabled={selectedSamples.length === 0}
                                    onPress={() => assignSelectedToPackage(pkg.id)}
                                >
                                    <Text
                                        style={[
                                            styles.assignButtonText,
                                            selectedSamples.length === 0 && styles.assignButtonTextDisabled,
                                        ]}
                                    >
                                        Assign Selected Samples
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Consolidate Packages</Text>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={() => openScanner("sample")}
                        >
                            <Ionicons name="qr-code-outline" size={18} color={palette.primaryForeground} />
                            <Text style={styles.scanButtonText}>Scan Samples</Text>
                        </TouchableOpacity>
                    </View>

                    {unassignedSamples.length === 0 ? (
                        <EmptyState
                            palette={palette}
                            icon="scan-outline"
                            title="No unassigned samples"
                            subtitle='Use "Scan Samples" to add'
                        />
                    ) : (
                        <View style={styles.unassignedList}>
                            {unassignedSamples.map((sample) => {
                                const isSelected = selectedSamples.includes(sample.id);
                                return (
                                    <TouchableOpacity
                                        key={sample.id}
                                        style={[
                                            styles.unassignedItem,
                                            isSelected && styles.unassignedItemSelected,
                                        ]}
                                        onPress={() => toggleSampleSelection(sample.id)}
                                    >
                                        <View>
                                            <Text style={styles.sampleCode}>{sample.code}</Text>
                                            <Text style={styles.sampleTimestamp}>
                                                {new Date(sample.timestamp).toLocaleTimeString([], {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removeUnassignedSample(sample.id)}
                                            style={styles.unassignedRemove}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={palette.destructive} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {packages.length > 0 ? (
                        <Text style={styles.selectionHint}>
                            Tap samples to select them, then choose "Assign Selected Samples" inside a package.
                        </Text>
                    ) : null}
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: 70 + insets.bottom }]}>
                <View style={styles.footerActions}>
                    <TouchableOpacity
                        style={styles.footerButton}
                        onPress={() => openScanner("package")}
                    >
                        <Ionicons name="cube-outline" size={18} color={palette.primary} />
                        <Text style={styles.footerButtonText}>Scan Packages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.footerButton}
                        onPress={() => openScanner("sample")}
                    >
                        <Ionicons name="scan-outline" size={18} color={palette.primary} />
                        <Text style={styles.footerButtonText}>Scan Samples</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.footerStatus}>
                    <Text style={styles.footerStatusText}>{statusMessage}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.confirmButton, confirmDisabled && styles.confirmButtonDisabled]}
                    disabled={confirmDisabled}
                    onPress={handleConfirmPickup}
                >
                    <Text
                        style={[
                            styles.confirmButtonText,
                            confirmDisabled && styles.confirmButtonTextDisabled,
                        ]}
                    >
                        {isSubmitting ? "Submitting..." : "Confirm Pick-Up"}
                    </Text>
                </TouchableOpacity>
            </View>

            <BottomNavigationMenu selectedTab="home" navigation={navigation} />

            <Modal
                visible={scannerVisible}
                transparent
                animationType="fade"
                onRequestClose={closeScanner}
            >
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerHeader}>
                        <Text style={styles.scannerTitle}>
                            {scannerMode === "package" ? "Scan Package" : "Scan Sample"}
                        </Text>
                        <TouchableOpacity onPress={closeScanner} style={styles.scannerClose}>
                            <Ionicons name="close" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    {scannerError ? (
                        <View style={styles.scannerError}>
                            <Ionicons name="warning-outline" size={18} color="#FFE5E5" />
                            <Text style={styles.scannerErrorText}>{scannerError}</Text>
                        </View>
                    ) : null}
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
                </View>
            </Modal>

            <UniversalModal
                visible={!!pendingPackageRemoval}
                title="Remove package?"
                description="Removing this package will move all of its samples back to the unassigned list."
                confirmText="Remove"
                cancelText="Cancel"
                onCancel={() => setPendingPackageRemoval(null)}
                onConfirm={confirmPackageRemoval}
                variant="destructive"
            />
        </View>
    );
};

const EmptyState = ({ palette, icon, title, subtitle }) => (
    <View style={[stylesEmpty.container, { borderColor: withAlpha(palette.border, "50") }]}>
        <Ionicons name={icon} size={26} color={palette.textSecondary} style={{ marginBottom: 8 }} />
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
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.card,
        },
        headerTitle: {
            flex: 1,
            marginHorizontal: 16,
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
            paddingBottom: 240,
            gap: 16,
        },
        sectionCard: {
            borderRadius: 18,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            padding: 16,
            gap: 14,
        },
        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        sectionTitle: {
            fontSize: Fonts.f16,
            fontWeight: "700",
            color: palette.textPrimary,
        },
        scanButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: palette.primary,
        },
        scanButtonText: {
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.primaryForeground,
        },
        packageCard: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.background,
            padding: 16,
            gap: 12,
        },
        packageCardActive: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, "12"),
        },
        packageHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        packageName: {
            fontSize: Fonts.f14,
            fontWeight: "700",
            color: palette.textPrimary,
        },
        packageBarcode: {
            marginTop: 2,
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        packageActions: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        packageActionButton: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: palette.card,
        },
        packageActionButtonActive: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, "16"),
        },
        packageActionText: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        packageActionTextActive: {
            color: palette.primary,
            fontWeight: "600",
        },
        packageRemoveButton: {
            padding: 6,
        },
        packageBody: {
            gap: 8,
        },
        packageCount: {
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.textPrimary,
        },
        packageHint: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        sampleChipList: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
        },
        sampleChip: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: palette.border,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: palette.background,
        },
        sampleChipText: {
            fontSize: Fonts.f12,
            color: palette.textPrimary,
        },
        assignButton: {
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: palette.primary,
        },
        assignButtonDisabled: {
            backgroundColor: withAlpha(palette.primary, "30"),
        },
        assignButtonText: {
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.primaryForeground,
        },
        assignButtonTextDisabled: {
            color: withAlpha(palette.primaryForeground, "70"),
        },
        unassignedList: {
            gap: 10,
        },
        unassignedItem: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.background,
        },
        unassignedItemSelected: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, "14"),
        },
        sampleCode: {
            fontSize: Fonts.f14,
            fontWeight: "600",
            color: palette.textPrimary,
        },
        sampleTimestamp: {
            marginTop: 2,
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        unassignedRemove: {
            padding: 6,
        },
        selectionHint: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        footer: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            backgroundColor: palette.background,
            borderTopWidth: 1,
            borderTopColor: withAlpha(palette.border, "60"),
            gap: 12,
        },
        footerActions: {
            flexDirection: "row",
            gap: 12,
        },
        footerButton: {
            flex: 1,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(palette.primary, "40"),
            backgroundColor: withAlpha(palette.primary, "12"),
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
        },
        footerButtonText: {
            fontSize: Fonts.f12,
            fontWeight: "600",
            color: palette.primary,
        },
        footerStatus: {
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            paddingVertical: 12,
            paddingHorizontal: 16,
            alignItems: "center",
        },
        footerStatusText: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        confirmButton: {
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            backgroundColor: palette.primary,
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
        scannerOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
        },
        scannerHeader: {
            position: "absolute",
            top: 60,
            left: 20,
            right: 20,
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
            marginTop: 24,
            gap: 12,
            alignItems: "center",
        },
        scannerNotice: {
            fontSize: Fonts.f12,
            color: withAlpha("#FFFFFF", "80"),
            textAlign: "center",
        },
        scannerError: {
            position: "absolute",
            top: 120,
            left: 40,
            right: 40,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
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
        borderRadius: 14,
        paddingVertical: 24,
        alignItems: "center",
        gap: 4,
    },
    title: {
        fontSize: Fonts.f14,
        fontWeight: "600",
    },
    subtitle: {
        fontSize: Fonts.f12,
    },
});

const ReceiveSamplesFromDriversPage = (props) => (
    <ThemeProvider>
        <ReceiveSamplesFromDriversPageContent {...props} />
    </ThemeProvider>
);

export default ReceiveSamplesFromDriversPage;
