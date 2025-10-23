import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import UniversalModal from '../components/UniversalModal';
import { Fonts } from '../utils/tokens';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';

const TakeMediaPageContent = ({ navigation, route }) => {
    const {
        routeName = '',
        idRoute = null,
        idCheckpoint = null,
        dispatchPhone = null,
        officePhone = null,
    } = route.params || {};

    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);

    const [capturedMedia, setCapturedMedia] = useState([]);
    const [finishModalVisible, setFinishModalVisible] = useState(false);
    const [removeModalVisible, setRemoveModalVisible] = useState(false);
    const [pendingRemovalIndex, setPendingRemovalIndex] = useState(null);
    const [previewIndex, setPreviewIndex] = useState(null);

    const previewItem = useMemo(
        () => (previewIndex === null ? null : capturedMedia[previewIndex] ?? null),
        [capturedMedia, previewIndex],
    );

    const imageMediaType = useMemo(() => {
        const mediaType = ImagePicker.MediaType;
        if (mediaType) {
            return mediaType.IMAGE ?? mediaType.IMAGES ?? mediaType.image ?? 'images';
        }
        return 'images';
    }, []);

    const videoMediaType = useMemo(() => {
        const mediaType = ImagePicker.MediaType;
        if (mediaType) {
            return mediaType.VIDEO ?? mediaType.VIDEOS ?? mediaType.video ?? 'videos';
        }
        return 'videos';
    }, []);

    const ensurePermissions = useCallback(async () => {
        const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
        const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();

        const hasCamera = cameraStatus.status === 'granted';
        const hasMedia = mediaStatus.status === 'granted';

        if (!hasCamera || !hasMedia) {
            Alert.alert(
                'Permissions required',
                'Camera and media library permissions are required to capture photos or videos.',
            );
            return false;
        }

        return true;
    }, []);

    const handleTakePhoto = useCallback(async () => {
        const hasPermission = await ensurePermissions();
        if (!hasPermission) {
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: imageMediaType,
            quality: 0.8,
        });

        if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
            const asset = result.assets[0];
            setCapturedMedia((prev) => [
                ...prev,
                {
                    uri: asset.uri,
                    type: 'photo',
                },
            ]);
        }
    }, [ensurePermissions]);

    const handleTakeVideo = useCallback(async () => {
        const hasPermission = await ensurePermissions();
        if (!hasPermission) {
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: videoMediaType,
            videoMaxDuration: 120,
            quality: 0.6,
        });

        if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
            const asset = result.assets[0];
            setCapturedMedia((prev) => [
                ...prev,
                {
                    uri: asset.uri,
                    type: 'video',
                },
            ]);
        }
    }, [ensurePermissions]);

    const handlePromptRemoveMedia = useCallback((index) => {
        setPendingRemovalIndex(index);
        setRemoveModalVisible(true);
    }, []);

    const handleConfirmRemoveMedia = useCallback(() => {
        if (pendingRemovalIndex === null) {
            return;
        }
        setCapturedMedia((prev) => prev.filter((_, idx) => idx !== pendingRemovalIndex));
        setPreviewIndex((current) => {
            if (current === null) {
                return current;
            }
            if (current === pendingRemovalIndex) {
                return null;
            }
            if (current > pendingRemovalIndex) {
                return current - 1;
            }
            return current;
        });
        setPendingRemovalIndex(null);
        setRemoveModalVisible(false);
    }, [pendingRemovalIndex]);

    const handleCancelRemoveMedia = useCallback(() => {
        setPendingRemovalIndex(null);
        setRemoveModalVisible(false);
    }, []);

    const handleOpenPreview = useCallback((index) => {
        setPreviewIndex(index);
    }, []);

    const handleClosePreview = useCallback(() => {
        setPreviewIndex(null);
    }, []);

    const handleOpenFinishModal = useCallback(() => {
        if (capturedMedia.length === 0) {
            return;
        }
        setFinishModalVisible(true);
    }, [capturedMedia.length]);

    const handleConfirmFinish = useCallback(() => {
        setFinishModalVisible(false);
        navigation.navigate('RoutesPage');
    }, [navigation]);

    const handleCancelFinish = useCallback(() => {
        setFinishModalVisible(false);
    }, []);

    const handleHelp = useCallback(() => {
        navigation.navigate('CheckpointViewPage', {
            routeName,
            idRoute,
            idCheckpoint,
            showHelp: true,
            dispatchPhone,
            officePhone,
        });
    }, [navigation, routeName, idRoute, idCheckpoint, dispatchPhone, officePhone]);

    return (
        <View style={styles.screen}>
            <View style={styles.headerRow}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>TAKE PICTURES/VIDEOS</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.mediaCard}>
                    <Text style={styles.mediaCardTitle}>Captured Media</Text>
                    {capturedMedia.length === 0 ? (
                        <View style={styles.mediaPlaceholder}>
                            <Text style={styles.mediaPlaceholderText}>
                                No photos or videos captured yet
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.mediaGrid}>
                            {capturedMedia.map((item, index) => (
                                <View key={`${item.uri}-${index}`} style={styles.mediaTile}>
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={() => handlePromptRemoveMedia(index)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialCommunityIcons
                                            name="trash-can-outline"
                                            size={18}
                                            color={palette.onAccent}
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.mediaTileContent}
                                        onPress={() => handleOpenPreview(index)}
                                        activeOpacity={0.85}
                                    >
                                        {item.type === 'video' ? (
                                            <View style={styles.videoThumbnail}>
                                                <Ionicons
                                                    name="videocam"
                                                    size={28}
                                                    color={palette.onPrimary}
                                                />
                                            </View>
                                        ) : (
                                            <Image source={{ uri: item.uri }} style={styles.photoThumbnail} />
                                        )}
                                        <Text style={styles.mediaLabel}>
                                            {item.type === 'video' ? 'Video' : 'Photo'} {index + 1}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={[styles.controlButton, styles.photoButton]}
                        onPress={handleTakePhoto}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="camera" size={18} color={palette.onPrimary} style={styles.controlIcon} />
                        <Text style={[styles.controlText, { color: palette.onPrimary }]}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, styles.videoButton]}
                        onPress={handleTakeVideo}
                        activeOpacity={0.85}
                    >
                        <Ionicons
                            name="videocam"
                            size={18}
                            color={palette.onSecondary}
                            style={styles.controlIcon}
                        />
                        <Text style={[styles.controlText, { color: palette.onSecondary }]}>Take Video</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[
                        styles.primaryActionButton,
                        {
                            backgroundColor:
                                capturedMedia.length === 0 ? palette.primaryDisabled : palette.primary,
                        },
                    ]}
                    disabled={capturedMedia.length === 0}
                    onPress={handleOpenFinishModal}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.primaryActionText, { color: palette.onPrimary }]}>FINISH</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={handleHelp}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.secondaryActionText, { color: palette.textPrimary }]}>HELP</Text>
                </TouchableOpacity>
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Route" />

            <UniversalModal
                visible={finishModalVisible}
                title="All required photos captured"
                description="Confirm to finish capturing and return to the previous step."
                confirmText="Confirm"
                cancelText="Back"
                onConfirm={handleConfirmFinish}
                onCancel={handleCancelFinish}
            />
            <UniversalModal
                visible={removeModalVisible}
                title="Remove file?"
                description="This will delete the selected photo or video from this visit."
                confirmText="Remove"
                cancelText="Keep"
                onConfirm={handleConfirmRemoveMedia}
                onCancel={handleCancelRemoveMedia}
            />

            <Modal visible={previewItem !== null} transparent animationType="fade">
                <View style={styles.previewBackdrop}>
                    <View style={[styles.previewContent, { backgroundColor: palette.card }]}>
                        {previewItem?.type === 'video' ? (
                            <Video
                                source={{ uri: previewItem.uri }}
                                style={styles.previewVideo}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                            />
                        ) : (
                            <Image
                                source={{ uri: previewItem?.uri }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        )}

                        <TouchableOpacity
                            style={[styles.previewCloseButton, { backgroundColor: palette.primary }]}
                            onPress={handleClosePreview}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.previewCloseText, { color: palette.onPrimary }]}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    onPrimary: tokens.primaryForeground || '#FFFFFF',
    primaryDisabled: tokens.primaryDisabled || tokens.primary + '55',
    secondary: tokens.secondary || '#1F2937',
    onSecondary: tokens.secondaryForeground || '#FFFFFF',
    accent: tokens.primary,
    onAccent: '#FFFFFF',
});

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 12,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
        },
        backButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
        },
        headerTitle: {
            flex: 1,
            textAlign: 'center',
            fontSize: Fonts.f20,
            fontWeight: '700',
            color: palette.textPrimary,
        },
        headerPlaceholder: {
            width: 36,
            height: 36,
        },
        contentContainer: {
            paddingBottom: 80,
            gap: 20,
        },
        mediaCard: {
            backgroundColor: palette.card,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: palette.border,
        },
        mediaCardTitle: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            color: palette.textPrimary,
            marginBottom: 16,
        },
        mediaPlaceholder: {
            minHeight: 140,
            alignItems: 'center',
            justifyContent: 'center',
        },
        mediaPlaceholderText: {
            fontSize: Fonts.f14,
            color: palette.textSecondary,
        },
        mediaGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        mediaTile: {
            width: '47%',
            backgroundColor: palette.background,
            borderRadius: 14,
            paddingVertical: 20,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: palette.border,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        },
        mediaTileContent: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
        },
        mediaIcon: {
            marginBottom: 6,
        },
        mediaLabel: {
            fontSize: Fonts.f12,
            fontWeight: '600',
            color: palette.textSecondary,
            textTransform: 'uppercase',
        },
        photoThumbnail: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: 12,
            backgroundColor: palette.background,
        },
        videoThumbnail: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.primary,
        },
        removeMediaButton: {
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: palette.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        controlsRow: {
            flexDirection: 'row',
            gap: 12,
        },
        controlButton: {
            flex: 1,
            height: 52,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        photoButton: {
            backgroundColor: palette.primary,
        },
        videoButton: {
            backgroundColor: palette.secondary,
        },
        controlIcon: {
            marginRight: 8,
        },
        controlText: {
            fontSize: Fonts.f14,
            fontWeight: '600',
        },
        primaryActionButton: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryActionText: {
            fontSize: Fonts.f16,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        secondaryActionButton: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
        },
        secondaryActionText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        previewBackdrop: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
        },
        previewContent: {
            width: '100%',
            borderRadius: 16,
            padding: 16,
            alignItems: 'center',
            gap: 16,
        },
        previewImage: {
            width: '100%',
            height: 280,
            borderRadius: 12,
        },
        previewVideo: {
            width: '100%',
            height: 280,
            borderRadius: 12,
        },
        previewCloseButton: {
            minWidth: 120,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewCloseText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
        },
    });

const TakeMediaPage = (props) => (
    <ThemeProvider>
        <TakeMediaPageContent {...props} />
    </ThemeProvider>
);

export default TakeMediaPage;
