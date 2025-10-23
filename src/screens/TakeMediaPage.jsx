import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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

    const handleRemoveMedia = useCallback((index) => {
        setCapturedMedia((prev) => prev.filter((_, idx) => idx !== index));
    }, []);

    const handleOpenFinishModal = useCallback(() => {
        if (capturedMedia.length === 0) {
            return;
        }
        setFinishModalVisible(true);
    }, [capturedMedia.length]);

    const handleConfirmFinish = useCallback(() => {
        setFinishModalVisible(false);
        navigation.goBack();
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
                                        onPress={() => handleRemoveMedia(index)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialCommunityIcons
                                            name="trash-can-outline"
                                            size={18}
                                            color={palette.onAccent}
                                        />
                                    </TouchableOpacity>

                                    <View style={styles.mediaTileContent}>
                                        {item.type === 'video' ? (
                                            <Ionicons
                                                name="videocam"
                                                size={28}
                                                color={palette.accent}
                                                style={styles.mediaIcon}
                                            />
                                        ) : (
                                            <Ionicons
                                                name="camera"
                                                size={28}
                                                color={palette.accent}
                                                style={styles.mediaIcon}
                                            />
                                        )}
                                        <Text style={styles.mediaLabel}>
                                            {item.type === 'video' ? 'Video' : 'Photo'} {index + 1}
                                        </Text>
                                    </View>
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
            gap: 6,
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
    });

const TakeMediaPage = (props) => (
    <ThemeProvider>
        <TakeMediaPageContent {...props} />
    </ThemeProvider>
);

export default TakeMediaPage;
