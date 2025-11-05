import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
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

const buildPackageName = (index) => `Package ${index}`;
const randomCode = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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

    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState(null);
    const [scannerNotice, setScannerNotice] = useState(null);
    const [manualEntry, setManualEntry] = useState("");

    const [banner, setBanner] = useState(null);
    const [pendingPackageRemoval, setPendingPackageRemoval] = useState(undefined);

    const scannerInputRef = useRef(null);

    const canConfirmReceipt =
        packages.length > 0 && packages.some((pkg) => pkg.samples.length > 0);

    const statusMessage = useMemo(() => {
        if (packages.length === 0) {
            return "Scan packages first, then add samples.";
        }
        if (!packages.some((pkg) => pkg.samples.length > 0)) {
            return "Assign sampled tubes to a package to proceed.";
        }
        return "Ready to confirm receipt.";
    }, [packages]);

    const setActivePackage = useCallback((packageId) => {
        setPackages((prev) =>
            prev.map((pkg) => ({
                ...pkg,
                isActive: pkg.id === packageId,
            })),
        );
        setActivePackageId(packageId);
    }, []);

    useEffect(() => {
        if (!banner) {
            return;
        }
        const timeout = setTimeout(() => setBanner(null), 3000);
        return () => clearTimeout(timeout);
    }, [banner]);

    useEffect(() => {
        if (!scannerVisible) {
            setScannerNotice(null);
            return;
        }

        const timer = setTimeout(() => {
            if (scannerMode === "package") {
                setScannerNotice("Point the camera at the package label");
            } else if (scannerMode === "sample") {
                setScannerNotice("Scan the sample barcode or enter it manually");
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
        setManualEntry("");
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
            setScannerMode(mode);
            setScannerVisible(true);
        },
        [ensureCameraPermission, showAlert],
    );

    const raiseDuplicateBanner = useCallback((message) => {
        setBanner({
            message,
            type: "warning",
            id: Date.now(),
        });
    }, []);

    const normalizeCode = (value) => value.trim().toUpperCase();

    const addPackage = useCallback(
        (rawCode) => {
            const barcode = normalizeCode(rawCode || randomCode("PKG"));
            if (!barcode) {
                return false;
            }

            const exists =
                packages.some((pkg) => pkg.barcode === barcode) ||
                unassignedSamples.some((sample) => sample.code === barcode);
            if (exists) {
                raiseDuplicateBanner("Package already scanned. Review the list below.");
                return false;
            }

            const nextPackage = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                barcode,
                name: buildPackageName(packages.length + 1),
                isActive: packages.length === 0,
                samples: [],
            };

            setPackages((prev) => {
                if (prev.length === 0) {
                    setActivePackageId(nextPackage.id);
                    return [nextPackage];
                }
                const updated = prev.map((pkg) => ({ ...pkg, isActive: false }));
                setActivePackageId(nextPackage.id);
                return [...updated, nextPackage];
            });

            showAlert({
                title: "Package Added",
                message: `${nextPackage.name} ready to receive samples.`,
                variant: "success",
            });

            return true;
        },
        [packages, raiseDuplicateBanner, showAlert, unassignedSamples],
    );

    const appendSampleToActive = useCallback(
        (sample) => {
            if (!activePackageId) {
                setUnassignedSamples((prev) => [...prev, sample]);
                return;
            }

            setPackages((prev) =>
                prev.map((pkg) =>
                    pkg.id === activePackageId
                        ? { ...pkg, samples: [...pkg.samples, sample] }
                        : pkg,
                ),
            );
        },
        [activePackageId],
    );
    const addSample = useCallback(
        (rawCode) => {
            const code = normalizeCode(rawCode || randomCode("SMP"));
            if (!code) {
                return false;
            }

            const duplicate =
                unassignedSamples.some((sample) => sample.code === code) ||
                packages.some((pkg) => pkg.samples.some((sample) => sample.code === code));

            if (duplicate) {
                raiseDuplicateBanner("Sample already captured. Check the lists below.");
                return false;
            }

            const sample = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                code,
                timestamp: new Date(),
            };

            appendSampleToActive(sample);

            if (activePackageId) {
                showAlert({
                    title: "Sample Assigned",
                    message: `${code} saved to the active package.`,
                    variant: "success",
                });
            } else {
                showAlert({
                    title: "Sample Added",
                    message: `${code} stored in unassigned samples.`,
                    variant: "info",
                });
            }
            return true;
        },
        [
            activePackageId,
            appendSampleToActive,
            packages,
            raiseDuplicateBanner,
            showAlert,
            unassignedSamples,
        ],
    );

    const handleCodeCaptured = useCallback(
        (code) => {
            if (!code) {
                return;
            }
            const action = scannerMode === "package" ? addPackage : addSample;
            const success = action(code);
            if (success) {
                closeScanner();
            }
        },
        [addPackage, addSample, closeScanner, scannerMode],
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
            nextActiveId = updatedPackages[0]?.id ?? null;
        }

        setPackages(updatedPackages.map((pkg) => ({ ...pkg, isActive: pkg.id === nextActiveId })));
        setActivePackageId(nextActiveId);
        setPendingPackageRemoval(null);

        showAlert({
            title: "Package Removed",
            message:
                returningSamples.length > 0
                    ? `${returningSamples.length} sample(s) returned to unassigned.`
                    : "Package removed successfully.",
            variant: "info",
        });
    }, [activePackageId, packages, pendingPackageRemoval, showAlert]);

    const handleConfirmReceipt = useCallback(() => {
        showAlert({
            title: "Receipt Confirmed",
            message: "All packages and samples recorded for the driver handoff.",
            variant: "success",
            onConfirm: () => navigation.goBack(),
        });
    }, [navigation, showAlert]);

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
                <Text style={styles.headerTitle}>Receive Samples from Drivers</Text>
                <View style={styles.headerSpacer} />
            </View>

            {banner ? (
                <View style={styles.banner}>
                    <Ionicons name="warning-outline" size={16} color={palette.destructive} />
                    <Text style={styles.bannerText}>{banner.message}</Text>
                    <TouchableOpacity onPress={() => setBanner(null)}>
                        <Ionicons name="close" size={18} color={palette.textSecondary} />
                    </TouchableOpacity>
                </View>
            ) : null}

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
                                                name="radio-button-on-outline"
                                                size={16}
                                                color={pkg.isActive ? palette.primary : palette.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.packageActionText,
                                                    pkg.isActive && styles.packageActionTextActive,
                                                ]}
                                            >
                                                {pkg.isActive ? "Active" : "Set Active"}
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

            <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
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
                    style={[styles.confirmButton, !canConfirmReceipt && styles.confirmButtonDisabled]}
                    disabled={!canConfirmReceipt}
                    onPress={handleConfirmReceipt}
                >
                    <Text
                        style={[
                            styles.confirmButtonText,
                            !canConfirmReceipt && styles.confirmButtonTextDisabled,
                        ]}
                    >
                        Confirm Receipt
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
                        <TextInput
                            ref={scannerInputRef}
                            value={manualEntry}
                            onChangeText={setManualEntry}
                            placeholder="Enter code manually"
                            placeholderTextColor={withAlpha("#FFFFFF", "70")}
                            style={styles.manualInput}
                            autoCapitalize="characters"
                            returnKeyType="done"
                            onSubmitEditing={() => handleCodeCaptured(manualEntry)}
                        />
                        <TouchableOpacity
                            style={styles.manualButton}
                            onPress={() => handleCodeCaptured(manualEntry)}
                        >
                            <Text style={styles.manualButtonText}>Add Code</Text>
                        </TouchableOpacity>
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
        banner: {
            marginHorizontal: 20,
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha(palette.destructive, "40"),
            backgroundColor: withAlpha(palette.destructive, "12"),
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
        },
        bannerText: {
            flex: 1,
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingBottom: 140,
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
        },
        scannerNotice: {
            fontSize: Fonts.f12,
            color: withAlpha("#FFFFFF", "80"),
            textAlign: "center",
        },
        manualInput: {
            width: "100%",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha("#FFFFFF", "30"),
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: "#FFFFFF",
            fontSize: Fonts.f14,
        },
        manualButton: {
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: "#FFFFFF",
        },
        manualButtonText: {
            fontSize: Fonts.f14,
            fontWeight: "600",
            color: "#000000",
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
