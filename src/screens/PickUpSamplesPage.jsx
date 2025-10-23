import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import UniversalModal from '../components/UniversalModal';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';
import { Fonts } from '../utils/tokens';
import { useInfoCheckpoint } from '../store/infoCheckpoint';
import { handleCallPress } from '../function/handleCallPress';
import CameraComponent from '../components/CameraComponent';
import { Camera, CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const withAlpha = (hex, alpha) => {
    if (typeof hex !== 'string' || !hex.startsWith('#')) {
        return hex;
    }
    const normalized = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${normalized}${alpha}`;
};

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const createPalette = (tokens) => ({
    background: tokens.background,
    card: tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    muted: tokens.mutedBackground || tokens.cardBackground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || '#FFFFFF',
    destructive: tokens.destructive,
    destructiveForeground: tokens.destructiveForeground || '#FFFFFF',
});

const PickUpSamplesPageContent = ({ navigation, route }) => {
    const {
        idRoute,
        routeName: routeNameParam = '',
        dispatchPhone: dispatchPhoneParam = null,
        officePhone: officePhoneParam = null,
    } = route.params || {};

    const { tokens, theme } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);
    const statusBarStyle = theme === 'dark' ? 'light' : 'dark';
    const topOverlayColor = palette.background;
    const bottomOverlayColor = tokens.navBackground || palette.background;

    const { data } = useInfoCheckpoint();
    const [unassignedSamples, setUnassignedSamples] = useState([]);
    const [selectedSampleIds, setSelectedSampleIds] = useState([]);
    const [packages, setPackages] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState(null);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);
    const [banner, setBanner] = useState(null);
    const [scannerNotice, setScannerNotice] = useState(null);
    const viewerListRef = useRef(null);
    const insets = useSafeAreaInsets();

    const dismissBanner = useCallback(() => setBanner(null), []);

    const showBanner = useCallback((message, type = 'warning', context = null) => {
        setBanner({ message, type, context, id: Date.now() });
    }, []);

    useEffect(() => {
        if (!banner) {
            return;
        }
        const timeout = setTimeout(() => {
            setBanner(null);
        }, 3000);
        return () => clearTimeout(timeout);
    }, [banner]);

    useEffect(() => {
        if (!scannerNotice) {
            return;
        }
        const timeout = setTimeout(() => {
            setScannerNotice(null);
        }, 2000);
        return () => clearTimeout(timeout);
    }, [scannerNotice]);

    useEffect(() => {
        if (!scannerVisible) {
            setScannerNotice(null);
        }
    }, [scannerVisible]);

    const checkpointName =
        routeNameParam || data?.name || data?.checkpointName || 'Checkpoint';

    const checkpointAddress = useMemo(() => {
        if (data?.address) {
            return data.address;
        }
        const parts = [
            data?.street,
            data?.city,
            data?.state,
            data?.zipCode,
        ].filter(Boolean);
        return parts.join(', ');
    }, [data]);

    const dispatchPhone = useMemo(
        () =>
            dispatchPhoneParam ||
            data?.dispatchPhone ||
            data?.phone ||
            data?.contactPhone ||
            null,
        [data, dispatchPhoneParam],
    );

    const officePhone = useMemo(
        () =>
            officePhoneParam ||
            data?.officePhone ||
            data?.contactOfficePhone ||
            data?.officeContact ||
            dispatchPhone ||
            null,
        [data, dispatchPhone, officePhoneParam],
    );

    const selectedSamples = useMemo(
        () => unassignedSamples.filter((sample) => selectedSampleIds.includes(sample.id)),
        [selectedSampleIds, unassignedSamples],
    );

    const hasSelectedSamples = selectedSampleIds.length > 0;
    const hasPackages = packages.length > 0;
    const totalSamplesCount = useMemo(
        () =>
            packages.reduce((sum, pkg) => sum + pkg.codes.length, 0) +
            unassignedSamples.length,
        [packages, unassignedSamples],
    );
    const hasScannedSamples = totalSamplesCount > 0;
    const hasPhotos = photos.length > 0;
    const canMarkDone = hasScannedSamples && hasPhotos;

    useEffect(() => {
        if (!hasPackages) {
            setSelectedSampleIds([]);
        }
    }, [hasPackages]);

    useEffect(() => {
        if (!banner) {
            return;
        }
        if (banner.context === 'sample-duplicate' && totalSamplesCount === 0) {
            setBanner(null);
        }
        if (banner.context === 'package-duplicate' && !hasPackages) {
            setBanner(null);
        }
    }, [banner, hasPackages, totalSamplesCount]);

    useEffect(() => {
        if (viewerVisible && photos.length === 0) {
            setViewerVisible(false);
        } else if (viewerVisible && viewerIndex >= photos.length) {
            setViewerIndex(Math.max(0, photos.length - 1));
        }
    }, [photos.length, viewerIndex, viewerVisible]);

    useEffect(() => {
        if (viewerVisible && viewerListRef.current) {
            try {
                viewerListRef.current.scrollToIndex({ index: viewerIndex, animated: false });
            } catch (error) {
                // ignore scroll errors
            }
        }
    }, [viewerIndex, viewerVisible]);

    const toggleSampleSelection = (id) => {
        setSelectedSampleIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
        );
    };

    const deleteUnassignedSample = (id) => {
        setUnassignedSamples((prev) => prev.filter((sample) => sample.id !== id));
        setSelectedSampleIds((prev) => prev.filter((item) => item !== id));
    };

    const handleActivateScanner = async (mode) => {
        try {
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Camera access is needed to scan barcodes.');
                return;
            }
            setScannerMode(mode);
            setScannerVisible(true);
        } catch (error) {
            Alert.alert('Permission error', 'Unable to request camera permission.');
        }
    };

    const handlePhotoTaken = (photo) => {
        setPhotos((prev) => [...prev, photo]);
        setIsCameraOpen(false);
    };

    const openPhotoViewer = (index) => {
        setViewerIndex(index);
        setViewerVisible(true);
    };

    const requestRemovePhoto = (index) => {
        setPendingDeleteIndex(index);
    };

    const removePhotoAtIndex = (index) => {
        setPhotos((prev) => {
            const updated = prev.filter((_, idx) => idx !== index);
            if (updated.length === 0) {
                setViewerVisible(false);
                setViewerIndex(0);
            } else if (viewerIndex >= updated.length) {
                setViewerIndex(updated.length - 1);
            }
            return updated;
        });
    };

    const handleConfirmRemovePhoto = () => {
        if (pendingDeleteIndex === null) {
            return;
        }
        removePhotoAtIndex(pendingDeleteIndex);
        setPendingDeleteIndex(null);
    };

    const handleCancelRemovePhoto = () => {
        setPendingDeleteIndex(null);
    };

    const handleSampleCode = (code) => {
        const normalized = code.trim();
        if (!normalized) {
            Alert.alert('Scan Failed', 'Unable to read the barcode. Please try again.');
            return false;
        }

        const existsInUnassigned = unassignedSamples.some((item) => item.code === normalized);
        const existsInPackages = packages.some((pkg) =>
            pkg.codes.some((item) => item.code === normalized),
        );

        if (existsInUnassigned || existsInPackages) {
            const message = 'This sample has already been scanned.';
            if (scannerVisible) {
                setScannerNotice(message);
            }
            //showBanner(message, 'warning', 'sample-duplicate');
            return false;
        }

        const newSample = {
            id: `${Date.now()}-${Math.random()}`,
            code: normalized,
            timestamp: new Date().toISOString(),
        };

        const targetPackage = packages.find((pkg) => pkg.isActiveTarget);
        if (targetPackage) {
            setPackages((prev) =>
                prev.map((pkg) =>
                    pkg.id === targetPackage.id
                        ? { ...pkg, codes: [...pkg.codes, newSample] }
                        : pkg,
                ),
            );
        } else {
            setUnassignedSamples((prev) => [...prev, newSample]);
        }

        return true;
    };

    const handlePackageCode = (code) => {
        const normalized = code.trim();
        if (!normalized) {
            Alert.alert('Scan Failed', 'Unable to read the barcode. Please try again.');
            return false;
        }

        const duplicate = packages.some((pkg) => pkg.barcode === normalized);
        if (duplicate) {
            const message = 'This package barcode has already been scanned.';
            if (scannerVisible) {
                setScannerNotice(message);
            }
            showBanner(message, 'warning', 'package-duplicate');
            return false;
        }

        const packageNumber = packages.length + 1;
        const newPackage = {
            id: `${Date.now()}-${Math.random()}`,
            barcode: normalized,
            name: `Package ${packageNumber}`,
            isActiveTarget: packages.length === 0,
            codes: [],
        };

        setPackages((prev) => [...prev, newPackage]);
        return true;
    };

    const moveSelectedSamplesToPackage = (packageId) => {
        if (selectedSamples.length === 0) {
            Alert.alert('Select Samples', 'Choose at least one sample to add to a package.');
            return;
        }

        setPackages((prev) =>
            prev.map((pkg) =>
                pkg.id === packageId
                    ? { ...pkg, codes: [...pkg.codes, ...selectedSamples] }
                    : pkg,
            ),
        );
        setUnassignedSamples((prev) => prev.filter((sample) => !selectedSampleIds.includes(sample.id)));
        setSelectedSampleIds([]);
    };

    const removeSampleFromPackage = (packageId, sampleId) => {
        let removed = null;
        setPackages((prev) =>
            prev.map((pkg) => {
                if (pkg.id !== packageId) {
                    return pkg;
                }
                const codes = pkg.codes.filter((code) => {
                    if (code.id === sampleId) {
                        removed = code;
                        return false;
                    }
                    return true;
                });
                return { ...pkg, codes };
            }),
        );
        if (removed) {
            setUnassignedSamples((prev) => [...prev, removed]);
        }
    };

    const deletePackage = (packageId) => {
        let returningSamples = [];
        setPackages((prev) =>
            prev.filter((pkg) => {
                if (pkg.id === packageId) {
                    returningSamples = pkg.codes;
                    return false;
                }
                return true;
            }),
        );
        if (returningSamples.length) {
            setUnassignedSamples((prev) => [...prev, ...returningSamples]);
        }
    };

    const togglePackageTarget = (packageId) => {
        setPackages((prev) =>
            prev.map((pkg) => {
                if (pkg.id === packageId) {
                    const nextValue = !pkg.isActiveTarget;
                    return { ...pkg, isActiveTarget: nextValue };
                }
                return { ...pkg, isActiveTarget: false };
            }),
        );
    };

    const handleMarkDone = () => {
        Alert.alert(
            'Pick Up Complete',
            'Samples and packages recorded successfully.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
    };

    if (isCameraOpen) {
        return (
            <CameraComponent
                navigation={navigation}
                onPhotoTaken={handlePhotoTaken}
                setIsCameraOpen={setIsCameraOpen}
            />
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar style={statusBarStyle} backgroundColor={topOverlayColor} translucent={false} />
            {insets.top > 0 ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.safeInsetOverlay,
                        { top: 0, height: insets.top, backgroundColor: topOverlayColor },
                    ]}
                />
            ) : null}
            {insets.bottom > 0 ? (
                <View
                    pointerEvents="none"
                    style={[
                        styles.safeInsetOverlay,
                        { bottom: 0, height: insets.bottom, backgroundColor: bottomOverlayColor },
                    ]}
                />
            ) : null}
            {banner && (
                <TouchableOpacity
                    style={[
                        styles.bannerWrapper,
                        banner.type === 'warning' ? styles.bannerWarning : styles.bannerInfo,
                    ]}
                    activeOpacity={0.9}
                    onPress={dismissBanner}
                >
                    <Ionicons
                        name={banner.type === 'warning' ? 'alert-circle-outline' : 'information-circle-outline'}
                        size={16}
                        color={banner.type === 'warning' ? palette.destructive : palette.primary}
                    />
                    <Text
                        style={[
                            styles.bannerText,
                            banner.type === 'warning' ? styles.bannerTextWarning : styles.bannerTextInfo,
                        ]}
                    >
                        {banner.message}
                    </Text>
                </TouchableOpacity>
            )}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerCard}>
                    <Text style={styles.headerTitle}>{checkpointName}</Text>
                    {checkpointAddress ? (
                        <Text style={styles.headerSubtitle}>{checkpointAddress}</Text>
                    ) : null}
                    <View style={styles.quickActionsRow}>
                        <QuickAction
                            label="Call Dispatch"
                            icon="call-outline"
                            onPress={() => dispatchPhone && handleCallPress(dispatchPhone)}
                            disabled={!dispatchPhone}
                            palette={palette}
                        />
                        <QuickAction
                            label="Contact Office"
                            icon="call"
                            onPress={() => officePhone && handleCallPress(officePhone)}
                            disabled={!officePhone}
                            palette={palette}
                        />
                        <QuickAction
                            label="Visit Info"
                            icon="information-circle-outline"
                            onPress={() =>
                                navigation.navigate('EntryInstructionsPage', {
                                    menu: false,
                                    data,
                                    routeName: checkpointName,
                                })
                            }
                            palette={palette}
                        />
                        <QuickAction
                            label="Text Dispatch"
                            icon="chatbubble-ellipses-outline"
                            onPress={() => navigation.navigate('ChatComponent', { menu: false, idRoute })}
                            palette={palette}
                        />
                    </View>
                </View>
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Scan Samples</Text>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={() => handleActivateScanner('sample')}
                        >
                            <Ionicons name="qr-code-outline" size={18} color={palette.primaryForeground} />
                            <Text style={styles.scanButtonText}>Scan Code</Text>
                        </TouchableOpacity>
                    </View>
                    {unassignedSamples.length === 0 ? (
                        <EmptyState
                            icon="cube-outline"
                            title="No samples yet"
                            subtitle='Use "Scan Code" to add'
                            palette={palette}
                        />
                    ) : (
                        <View style={styles.listContainer}>
                            {unassignedSamples.map((sample) => {
                                const isSelected = selectedSampleIds.includes(sample.id);
                                return (
                                    <TouchableOpacity
                                        key={sample.id}
                                        style={[styles.sampleItem, isSelected && styles.sampleItemSelected]}
                                        activeOpacity={0.85}
                                        onPress={() => (hasPackages ? toggleSampleSelection(sample.id) : null)}
                                        onLongPress={() => toggleSampleSelection(sample.id)}
                                    >
                                        <View>
                                            <Text style={styles.sampleCode}>{sample.code}</Text>
                                            <Text style={styles.sampleTimestamp}>
                                                {new Date(sample.timestamp).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => deleteUnassignedSample(sample.id)}
                                            style={styles.removeIcon}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={palette.destructive} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                    {hasPackages ? (
                        <Text style={styles.selectionHint}>
                            Tap samples to select them. Scan a package or use "Add Selected" to assign.
                        </Text>
                    ) : null}
                </View>

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Packages</Text>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={() => handleActivateScanner('package')}
                        >
                            <Ionicons name="qr-code-outline" size={18} color={palette.primaryForeground} />
                            <Text style={styles.scanButtonText}>Scan Consolidate Package</Text>
                        </TouchableOpacity>
                    </View>

                    {packages.length === 0 ? (
                        <EmptyState
                            icon="briefcase-outline"
                            title="No packages"
                            subtitle='Scan consolidate package to create one'
                            palette={palette}
                        />
                    ) : (
                        packages.map((pkg) => (
                            <View
                                key={pkg.id}
                                style={[styles.packageCard, pkg.isActiveTarget && styles.packageCardActive]}
                            >
                                <View style={styles.packageHeader}>
                                    <View>
                                        <Text style={styles.packageTitle}>{pkg.name}</Text>
                                        <Text style={styles.packageSubtitle}>{pkg.barcode}</Text>
                                    </View>
                                    <View style={styles.packageActions}>
                                        <TouchableOpacity
                                            style={[
                                                styles.packageActionButton,
                                                pkg.isActiveTarget && styles.packageActionButtonActive,
                                            ]}
                                            onPress={() => togglePackageTarget(pkg.id)}
                                        >
                                            <Ionicons
                                                name="radio-button-on-outline"
                                                size={16}
                                                color={pkg.isActiveTarget ? palette.primary : palette.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.packageActionText,
                                                    pkg.isActiveTarget && styles.packageActionTextActive,
                                                ]}
                                            >
                                                {pkg.isActiveTarget ? 'Target Active' : 'Set as Target'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.packageDeleteButton}
                                            onPress={() => deletePackage(pkg.id)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color={palette.destructive} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.addSelectedButton,
                                        (!hasSelectedSamples || selectedSamples.length === 0) &&
                                            styles.addSelectedButtonDisabled,
                                    ]}
                                    disabled={!hasSelectedSamples}
                                    onPress={() => moveSelectedSamplesToPackage(pkg.id)}
                                >
                                    <Text
                                        style={[
                                            styles.addSelectedText,
                                            (!hasSelectedSamples || selectedSamples.length === 0) &&
                                                styles.addSelectedTextDisabled,
                                        ]}
                                    >
                                        Add Selected Samples
                                    </Text>
                                </TouchableOpacity>

                                {pkg.codes.length === 0 ? (
                                    <Text style={styles.packageHint}>No samples yet.</Text>
                                ) : (
                                    <View style={styles.packageSamples}>
                                        {pkg.codes.map((sample) => (
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
                        ))
                    )}
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Overall Photos</Text>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => setIsCameraOpen(true)}
                    >
                        <Ionicons name="camera-outline" size={18} color={palette.primary} />
                        <Text style={styles.uploadButtonText}>Upload Photo</Text>
                    </TouchableOpacity>
                    {photos.length > 0 ? (
                        <FlatList
                            data={photos}
                            keyExtractor={(_, index) => `${index}`}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.photoList}
                            renderItem={({ item, index }) => (
                                <TouchableOpacity
                                    style={styles.photoItem}
                                    activeOpacity={0.85}
                                    onPress={() => openPhotoViewer(index)}
                                >
                                    <Image source={{ uri: item.uri }} style={styles.photoImage} />
                                    <TouchableOpacity
                                        style={styles.photoRemove}
                                        onPress={(event) => {
                                            event?.stopPropagation?.();
                                            requestRemovePhoto(index);
                                        }}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={palette.destructive} />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.photoHint}>No photos yet.</Text>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.markButton, canMarkDone ? styles.markButtonEnabled : styles.markButtonDisabled]}
                    disabled={!canMarkDone}
                    onPress={handleMarkDone}
                >
                    <Text
                        style={[
                            styles.markButtonText,
                            !canMarkDone && styles.markButtonTextDisabled,
                        ]}
                    >
                        Mark as Done
                    </Text>
                </TouchableOpacity>
                <Text style={styles.footerHint}>Required: samples + at least 1 photo.</Text>
            </View>

            <Modal
                visible={viewerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setViewerVisible(false)}
            >
                <View style={styles.viewerOverlay}>
                    <View style={styles.viewerHeader}>
                        <TouchableOpacity
                            style={styles.viewerCloseButton}
                            onPress={() => setViewerVisible(false)}
                        >
                            <Ionicons name="close" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                        {photos.length > 0 ? (
                            <Text style={styles.viewerCounter}>
                                {`${viewerIndex + 1}/${photos.length}`}
                            </Text>
                        ) : null}
                        <TouchableOpacity
                            style={styles.viewerDeleteButton}
                            onPress={() => requestRemovePhoto(viewerIndex)}
                        >
                            <Ionicons name="trash-outline" size={26} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        ref={viewerListRef}
                        data={photos}
                        keyExtractor={(_, index) => `${index}`}
                        horizontal
                        pagingEnabled
                        initialScrollIndex={viewerIndex}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.viewerImageContainer}>
                                <Image source={{ uri: item.uri }} style={styles.viewerImage} resizeMode="contain" />
                            </View>
                        )}
                        getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
                        onMomentumScrollEnd={(event) => {
                            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
                            setViewerIndex(nextIndex);
                        }}
                        extraData={viewerIndex}
                    />
                </View>
            </Modal>

            <UniversalModal
                visible={pendingDeleteIndex !== null}
                title="Delete photo?"
                description="Are you sure you want to delete this photo?"
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleConfirmRemovePhoto}
                onCancel={handleCancelRemovePhoto}
            />

            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
            <ScannerModal
                visible={scannerVisible}
                mode={scannerMode}
                onClose={() => setScannerVisible(false)}
                onCodeScanned={(value) =>
                    scannerMode === 'sample' ? handleSampleCode(value) : handlePackageCode(value)
                }
                notice={scannerNotice}
                palette={palette}
            />
        </View>
    );
};

const QuickAction = ({ label, icon, onPress, disabled = false, palette }) => (
    <TouchableOpacity
        style={[quickStyles.button, disabled && quickStyles.buttonDisabled]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        activeOpacity={disabled ? 1 : 0.85}
    >
        <Ionicons
            name={icon}
            size={18}
            color={disabled ? palette.textSecondary + '80' : palette.primary}
        />
        <Text style={[quickStyles.label, { color: palette.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
);

const quickStyles = StyleSheet.create({
    button: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    label: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        textAlign: 'center',
    },
});

const EmptyState = ({ icon, title, subtitle, palette }) => (
    <View style={stylesEmpty.container}>
        <Ionicons name={icon} size={24} color={palette.textSecondary} style={{ marginBottom: 8 }} />
        <Text style={[stylesEmpty.title, { color: palette.textPrimary }]}>{title}</Text>
        <Text style={[stylesEmpty.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
    </View>
);
const stylesEmpty = StyleSheet.create({
    container: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: Fonts.f14,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: Fonts.f12,
    },
});

const ScannerModal = ({ visible, mode, onClose, onCodeScanned, notice, palette }) => {
    const [hasPermission, setHasPermission] = useState(null);
    const processingRef = useRef(false);

    useEffect(() => {
        if (visible) {
            processingRef.current = false;
            (async () => {
                try {
                    const { status } = await Camera.getCameraPermissionsAsync();
                    setHasPermission(status === 'granted');
                } catch {
                    setHasPermission(false);
                }
            })();
        } else {
            setHasPermission(null);
            processingRef.current = false;
        }
    }, [visible]);

    const resetProcessing = () => {
        processingRef.current = false;
    };

    const handleScanned = ({ data }) => {
        if (!data || processingRef.current) {
            return;
        }
        processingRef.current = true;
        const accepted = onCodeScanned(data);
        if (accepted) {
            setTimeout(() => {
                resetProcessing();
                onClose();
            }, 250);
        } else {
            resetProcessing();
        }
    };

    const handleRequestClose = () => {
        resetProcessing();
        onClose();
    };

    if (!visible) {
        return null;
    }

    return (
        <Modal visible transparent animationType="fade" onRequestClose={handleRequestClose}>
            <View style={scannerStyles.overlay}>
                <View style={scannerStyles.cameraShell}>
                    {hasPermission === null ? (
                        <Text style={[scannerStyles.infoText, { color: palette.primary }]}>Requesting camera permission...</Text>
                    ) : hasPermission === false ? (
                        <Text style={[scannerStyles.infoText, { color: palette.destructive }]}>Camera permission denied. Enable access in settings.</Text>
                    ) : (
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            facing="back"
                            barcodeScannerSettings={{
                                barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'pdf417', 'upc_e'],
                            }}
                            onBarcodeScanned={handleScanned}
                        />
                    )}
                    {notice ? (
                        <View
                            pointerEvents="none"
                            style={[
                                scannerStyles.notice,
                                { backgroundColor: withAlpha(palette.destructive, 'C0') },
                            ]}
                        >
                            <Ionicons
                                name="alert-circle-outline"
                                size={18}
                                color={palette.destructiveForeground}
                            />
                            <Text
                                style={[
                                    scannerStyles.noticeText,
                                    { color: palette.destructiveForeground },
                                ]}
                            >
                                {notice}
                            </Text>
                        </View>
                    ) : null}
                    <View style={scannerStyles.header}>
                        <Text style={[scannerStyles.title, { color: palette.primaryForeground }]}>
                            {mode === 'sample' ? 'Scan Sample' : 'Scan Package'}
                        </Text>
                    </View>
                    <TouchableOpacity style={scannerStyles.close} onPress={handleRequestClose}>
                        <Ionicons name="close" size={28} color={palette.primaryForeground} />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const scannerStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    cameraShell: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    infoText: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -120 }, { translateY: -10 }],
        width: 240,
        textAlign: 'center',
        fontSize: Fonts.f14,
    },
    notice: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    noticeText: {
        fontSize: Fonts.f12,
        fontWeight: '600',
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
    },
    title: {
        fontSize: Fonts.f16,
        fontWeight: '700',
    },
    close: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 20,
        padding: 6,
    },
});

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        safeInsetOverlay: {
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 0,
        },
        bannerWrapper: {
            marginHorizontal: 20,
            marginTop: 16,
            marginBottom: 8,
            borderRadius: 14,
            paddingVertical: 10,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        bannerWarning: {
            backgroundColor: withAlpha(palette.destructive, '20'),
            borderColor: withAlpha(palette.destructive, '40'),
        },
        bannerInfo: {
            backgroundColor: withAlpha(palette.primary, '20'),
            borderColor: withAlpha(palette.primary, '40'),
        },
        bannerText: {
            fontSize: Fonts.f12,
            fontWeight: '600',
        },
        bannerTextWarning: {
            color: palette.destructive,
        },
        bannerTextInfo: {
            color: palette.primary,
        },
        scrollContent: {
            paddingBottom: 160,
            paddingHorizontal: 20,
            paddingTop: 16,
            gap: 16,
        },
        headerCard: {
            backgroundColor: palette.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.border,
            padding: 20,
            gap: 12,
        },
        headerTitle: {
            fontSize: Fonts.f20,
            fontWeight: '700',
            color: palette.textPrimary,
        },
        headerSubtitle: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        quickActionsRow: {
            flexDirection: 'row',
            gap: 12,
        },
        sectionCard: {
            backgroundColor: palette.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.border,
            padding: 20,
            gap: 14,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        sectionTitle: {
            fontSize: Fonts.f16,
            fontWeight: '700',
            color: palette.textPrimary,
        },
        scanButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: palette.primary,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            gap: 8,
        },
        scanButtonText: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.primaryForeground,
        },
        listContainer: {
            gap: 10,
        },
        sampleItem: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            padding: 14,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        sampleItemSelected: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, '15'),
        },
        sampleCode: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.textPrimary,
        },
        sampleTimestamp: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
            marginTop: 4,
        },
        removeIcon: {
            padding: 4,
        },
        selectionHint: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
            textAlign: 'center',
        },
        packageCard: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            padding: 16,
            gap: 12,
        },
        packageCardActive: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, '12'),
        },
        packageHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        packageTitle: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.textPrimary,
        },
        packageSubtitle: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
            marginTop: 4,
        },
        packageActions: {
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
        },
        packageActionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        packageActionButtonActive: {
            borderColor: palette.primary,
            backgroundColor: withAlpha(palette.primary, '20'),
        },
        packageActionText: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        packageActionTextActive: {
            color: palette.primary,
            fontWeight: '600',
        },
        packageDeleteButton: {
            padding: 8,
        },
        addSelectedButton: {
            borderRadius: 12,
            paddingVertical: 10,
            alignItems: 'center',
            backgroundColor: palette.primary,
        },
        addSelectedButtonDisabled: {
            backgroundColor: withAlpha(palette.primary, '30'),
        },
        addSelectedText: {
            fontSize: Fonts.f12,
            fontWeight: '600',
            color: palette.primaryForeground,
        },
        addSelectedTextDisabled: {
            color: withAlpha(palette.primaryForeground, '70'),
        },
        packageHint: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        packageSamples: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        sampleChip: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            paddingHorizontal: 10,
            paddingVertical: 6,
            gap: 6,
        },
        sampleChipText: {
            fontSize: Fonts.f12,
            color: palette.textPrimary,
        },
        uploadButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 14,
            paddingVertical: 14,
            justifyContent: 'center',
        },
        uploadButtonText: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.primary,
        },
        photoList: {
            marginTop: 16,
            gap: 12,
        },
        photoItem: {
            width: 90,
            height: 90,
            borderRadius: 12,
            overflow: 'hidden',
            marginRight: 12,
            backgroundColor: palette.muted,
        },
        photoImage: {
            width: '100%',
            height: '100%',
        },
        photoRemove: {
            position: 'absolute',
            top: 6,
            right: 6,
            backgroundColor: withAlpha(palette.background, '90'),
            borderRadius: 14,
            padding: 4,
        },
        viewerOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        viewerHeader: {
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
        },
        viewerCloseButton: {
            padding: 8,
            backgroundColor: 'rgba(0,0,0,0.4)',
            borderRadius: 20,
        },
        viewerDeleteButton: {
            padding: 8,
            backgroundColor: 'rgba(0,0,0,0.4)',
            borderRadius: 20,
        },
        viewerCounter: {
            color: '#FFFFFF',
            fontSize: Fonts.f14,
            fontWeight: '600',
        },
        viewerImageContainer: {
            width: windowWidth,
            height: windowHeight,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
        },
        viewerImage: {
            width: '100%',
            height: '100%',
        },
        photoHint: {
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
        footer: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 72,
            paddingHorizontal: 20,
            paddingBottom: 24,
            paddingTop: 16,
            backgroundColor: palette.background,
            borderTopWidth: 1,
            borderTopColor: withAlpha(palette.border, '80'),
        },
        markButton: {
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        markButtonEnabled: {
            backgroundColor: palette.primary,
        },
        markButtonDisabled: {
            backgroundColor: withAlpha(palette.textSecondary, '20'),
        },
        markButtonText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            color: palette.primaryForeground,
        },
        markButtonTextDisabled: {
            color: withAlpha(palette.textPrimary, '40'),
        },
        footerHint: {
            marginTop: 10,
            textAlign: 'center',
            fontSize: Fonts.f12,
            color: palette.textSecondary,
        },
    });

const PickUpSamplesPage = (props) => (
    <ThemeProvider>
        <PickUpSamplesPageContent {...props} />
    </ThemeProvider>
);

export default PickUpSamplesPage;
