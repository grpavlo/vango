import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import { Fonts } from '../utils/tokens';
import { useInfoCheckpoint } from '../store/infoCheckpoint';
import * as SecureStore from 'expo-secure-store';
import { serverUrlApi } from '../const/api';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';

const BUTTON_GREEN = '#22C55E';
const BUTTON_ORANGE = '#EA580C';
const BUTTON_RED = '#EF4444';
const BUTTON_YELLOW = '#D97706';

const ArrivalCheckPageContent = ({ navigation, route }) => {
    const {
        idCheckpoint,
        idRoute,
        routeName = '',
        last = false,
        isDropOff = false,
        isDefaultUnload = false,
    } = route.params || {};

    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createArrivalColors(tokens), [tokens]);
    const styles = useMemo(() => createArrivalStyles(palette), [palette]);
    const { data } = useInfoCheckpoint();
    const [isProcessing, setIsProcessing] = useState(false);
    const [officeCheckVisible, setOfficeCheckVisible] = useState(false);
    const [samplesModalVisible, setSamplesModalVisible] = useState(false);
    const [otherIssuesModalVisible, setOtherIssuesModalVisible] = useState(false);

    const derivedLastFlag = data?.last ?? last ?? false;
    const dispatchPhone =
        data?.dispatchPhone || data?.phone || data?.contactPhone || null;
    const officePhone =
        data?.officePhone || data?.contactOfficePhone || data?.officeContact || dispatchPhone || null;

    const runAction = useCallback(
        async (task) => {
            if (isProcessing) {
                return;
            }
            setIsProcessing(true);
            try {
                await task();
            } catch (error) {
                let message = 'Something went wrong. Please try again.';
                if (error?.message) {
                    switch (error.message) {
                        case 'AUTH_MISSING':
                            message = 'Authentication token is missing. Please log in again.';
                            break;
                        case 'ROUTE_MISSING':
                            message = 'Unable to determine the current route.';
                            break;
                        case 'ROUTE_FETCH_FAILED':
                            message = 'Failed to load route details. Please try again.';
                            break;
                        case 'UNLOAD_NOT_FOUND':
                            message = 'Unable to find the unload visit for this route.';
                            break;
                        default:
                            message = 'Something went wrong. Please try again.';
                            break;
                    }
                }
                Alert.alert('Error', message);
            } finally {
                setIsProcessing(false);
            }
        },
        [isProcessing],
    );

    const navigateToConfirmUpload = useCallback(async () => {
        const accessToken = await SecureStore.getItemAsync('accessToken');
        if (!accessToken) {
            throw new Error('AUTH_MISSING');
        }

        let effectiveRouteId = idRoute;
        if (!effectiveRouteId) {
            const storedRouteId = await SecureStore.getItemAsync('idRoute');
            effectiveRouteId = storedRouteId || undefined;
        }

        if (!effectiveRouteId) {
            throw new Error('ROUTE_MISSING');
        }

        if (isDefaultUnload) {
            const response = await fetch(`${serverUrlApi}routes/${effectiveRouteId}`, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('ROUTE_FETCH_FAILED');
            }

            const dataRoute = await response.json();
            const visitsData = dataRoute?.visits || [];
            const completedData = dataRoute?.completedVisits || [];
            let foundUnloadVisit = visitsData.find((visit) => visit.isDefaultUnload);

            if (!foundUnloadVisit) {
                foundUnloadVisit = completedData.find((visit) => visit.isDefaultUnload);
            }

            if (!foundUnloadVisit) {
                throw new Error('UNLOAD_NOT_FOUND');
            }

            navigation.navigate('ConfirmUploadPage', {
                idCheckpoint: foundUnloadVisit.id,
                last: derivedLastFlag,
                idRoute: effectiveRouteId,
            });
            return;
        }

        navigation.navigate('ConfirmUploadPage', {
            idCheckpoint,
            last: derivedLastFlag,
            idRoute: effectiveRouteId,
        });
    }, [derivedLastFlag, idCheckpoint, idRoute, isDefaultUnload, navigation]);

    const handlePickUpSamples = useCallback(() => {
        if (isProcessing) {
            return;
        }

        if (isDropOff) {
            runAction(navigateToConfirmUpload);
            return;
        }

        navigation.push('CheckpointViewPage', {
            idCheckpoint,
            idRoute,
            routeName,
            showPickUp: true,
            dispatchPhone,
            officePhone,
        });
    }, [
        idCheckpoint,
        idRoute,
        isDropOff,
        isProcessing,
        navigateToConfirmUpload,
        navigation,
        routeName,
        runAction,
        dispatchPhone,
        officePhone,
    ]);

    const openOfficeCheck = useCallback(() => {
        setOfficeCheckVisible(true);
    }, []);

    const closeModals = useCallback(() => {
        setOfficeCheckVisible(false);
        setSamplesModalVisible(false);
    }, []);

    const handleEmptyBox = useCallback(() => {
        if (isProcessing) {
            return;
        }

        if (isDropOff) {
            runAction(navigateToConfirmUpload);
            return;
        }

        openOfficeCheck();
    }, [
        isProcessing,
        isDropOff,
        runAction,
        navigateToConfirmUpload,
        openOfficeCheck,
    ]);

    const handleUnableToFind = useCallback(() => {
        if (isProcessing) {
            return;
        }

        if (isDropOff) {
            runAction(navigateToConfirmUpload);
            return;
        }

        openOfficeCheck();
    }, [
        isProcessing,
        isDropOff,
        runAction,
        navigateToConfirmUpload,
        openOfficeCheck,
    ]);

    const handleOfficeOpen = useCallback(() => {
        setOfficeCheckVisible(false);
        setSamplesModalVisible(true);
    }, []);

    const navigateToClosedOffice = useCallback(() => {
        closeModals();
        navigation.navigate('ClosedOfficeFormPage', {
            idRoute,
            idCheckpoint,
            routeName,
            dispatchPhone,
            officePhone,
        });
    }, [
        closeModals,
        navigation,
        idRoute,
        idCheckpoint,
        routeName,
        dispatchPhone,
        officePhone,
    ]);

    const handleSamplesYes = useCallback(() => {
        closeModals();
        navigation.navigate('CheckpointViewPage', {
            idCheckpoint,
            idRoute,
            routeName,
            showPickUp: true,
            dispatchPhone,
            officePhone,
        });
    }, [
        closeModals,
        navigation,
        idCheckpoint,
        idRoute,
        routeName,
        dispatchPhone,
        officePhone,
    ]);

    const handleSamplesNo = useCallback(() => {
        closeModals();
        navigation.navigate('NoSamplesFormPage', {
            idRoute,
            idCheckpoint,
            routeName,
            dispatchPhone,
            officePhone,
        });
    }, [
        closeModals,
        navigation,
        idRoute,
        idCheckpoint,
        routeName,
        dispatchPhone,
        officePhone,
    ]);

    const closeOtherIssuesModal = useCallback(() => {
        setOtherIssuesModalVisible(false);
    }, []);

    const handleOtherIssues = useCallback(() => {
        if (isProcessing) {
            return;
        }
        setOtherIssuesModalVisible(true);
    }, [isProcessing]);

    const handleOtherIssuesConfirm = useCallback(() => {
        closeOtherIssuesModal();
        navigation.navigate('TakeMediaPage', {
            idCheckpoint,
            idRoute,
            routeName,
            dispatchPhone,
            officePhone,
        });
    }, [
        closeOtherIssuesModal,
        navigation,
        idCheckpoint,
        idRoute,
        routeName,
        dispatchPhone,
        officePhone,
    ]);

    const handleVisitNotes = useCallback(() => {
        if (isProcessing) {
            return;
        }
        navigation.navigate('EntryInstructionsPage', {
            menu: false,
            routeName,
        });
    }, [isProcessing, navigation, routeName]);

    const handleHelp = useCallback(() => {
        if (isProcessing) {
            return;
        }
        navigation.push('CheckpointViewPage', {
            idRoute,
            routeName,
            idCheckpoint,
            showHelp: true,
            dispatchPhone,
            officePhone,
        });
    }, [dispatchPhone, idCheckpoint, idRoute, isProcessing, navigation, officePhone, routeName]);


    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <Text style={styles.title}>Arrival / Check</Text>

                <View style={styles.primaryActions}>
                    <ActionButton
                        label="PICK UP SAMPLES"
                        icon="cube-outline"
                        backgroundColor={BUTTON_GREEN}
                        onPress={handlePickUpSamples}
                        disabled={isProcessing}
                        style={styles.primaryButtonSpacing}
                        styles={styles}
                        palette={palette}
                    />
                    <ActionButton
                        label="EMPTY BOX"
                        icon="cube"
                        backgroundColor={BUTTON_ORANGE}
                        onPress={handleEmptyBox}
                        disabled={isProcessing}
                        style={styles.primaryButtonSpacing}
                        styles={styles}
                        palette={palette}
                    />
                    <ActionButton
                        label="UNABLE TO FIND THE BOX"
                        icon="search"
                        backgroundColor={BUTTON_RED}
                        onPress={handleUnableToFind}
                        disabled={isProcessing}
                        style={styles.primaryButtonSpacing}
                        styles={styles}
                        palette={palette}
                    />
                    <ActionButton
                        label="OTHER ISSUES"
                        icon="warning-outline"
                        backgroundColor={BUTTON_YELLOW}
                        onPress={handleOtherIssues}
                        disabled={isProcessing}
                        styles={styles}
                        palette={palette}
                    />
                </View>

                <View style={styles.secondaryActions}>
                    <SecondaryActionButton
                        label="VISIT NOTES"
                        styles={styles}
                        palette={palette}
                        icon="document-text-outline"
                        onPress={handleVisitNotes}
                        disabled={isProcessing}
                        style={styles.secondaryButtonSpacing}
                    />
                    <SecondaryActionButton
                        label="HELP"
                        styles={styles}
                        palette={palette}
                        icon="help-circle-outline"
                        onPress={handleHelp}
                        disabled={isProcessing}
                    />
                </View>
            </ScrollView>

            <BottomNavigationMenu navigation={navigation} activeTab="Route" />

            <DecisionModal
                visible={officeCheckVisible}
                title="CHECK IF THE OFFICE IS OPEN"
                primaryLabel="OPEN"
                secondaryLabel="CLOSED"
                onPrimaryPress={handleOfficeOpen}
                onSecondaryPress={navigateToClosedOffice}
                onRequestClose={closeModals}
                styles={styles}
                palette={palette}
            />

            <DecisionModal
                visible={samplesModalVisible}
                title="DO THEY HAVE ANY SAMPLES?"
                primaryLabel="YES"
                secondaryLabel="NO"
                onPrimaryPress={handleSamplesYes}
                onSecondaryPress={handleSamplesNo}
                onRequestClose={closeModals}
                styles={styles}
                palette={palette}
            />

            <Modal
                visible={otherIssuesModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeOtherIssuesModal}
            >
                <View style={styles.alertBackdrop}>
                    <View style={styles.alertCard}>
                        <Text style={styles.alertTitle}>ATTENTION!!!</Text>
                        <Text style={styles.alertMessage}>
                            Please describe the situation in detail and take photos of the area and the
                            building to document the issue.
                        </Text>
                        <TouchableOpacity
                            style={[styles.alertButton, { backgroundColor: palette.primary }]}
                            onPress={handleOtherIssuesConfirm}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.alertButtonLabel, { color: palette.onPrimary }]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const ActionButton = ({ label, icon, backgroundColor, onPress, disabled, style, styles, palette }) => (
    <TouchableOpacity
        style={[
            styles.primaryButton,
            { backgroundColor },
            disabled && styles.primaryButtonDisabled,
            style,
        ]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.85}
        disabled={disabled}
    >
        <Ionicons name={icon} size={20} color={palette.onPrimary} style={styles.primaryIcon} />
        <Text style={styles.primaryLabel}>{label}</Text>
    </TouchableOpacity>
);

const SecondaryActionButton = ({ label, icon, onPress, disabled, style, styles, palette }) => (
    <TouchableOpacity
        style={[styles.secondaryButton, disabled && styles.secondaryButtonDisabled, style]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.85}
        disabled={disabled}
    >
        <Ionicons name={icon} size={18} color={palette.textPrimary} style={styles.secondaryIcon} />
        <Text style={styles.secondaryLabel}>{label}</Text>
    </TouchableOpacity>
);

const DecisionModal = ({
    visible,
    title,
    primaryLabel,
    secondaryLabel,
    onPrimaryPress,
    onSecondaryPress,
    onRequestClose,
    styles,
    palette,
}) => (
    <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onRequestClose}
    >
        <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{title}</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity
                        style={[styles.modalButton, { backgroundColor: palette.primary }]}
                        onPress={onPrimaryPress}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.modalButtonText, { color: palette.onPrimary }]}>
                            {primaryLabel}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalButton, { backgroundColor: palette.surfaceMuted }]}
                        onPress={onSecondaryPress}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.modalButtonText, { color: palette.textPrimary }]}>
                            {secondaryLabel}
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity
                    onPress={onRequestClose}
                    style={styles.modalCancel}
                    activeOpacity={0.7}
                >
                    <Text style={styles.modalCancelLabel}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>
);

const createArrivalColors = (tokens) => ({
    background: tokens.background,
    surface: tokens.cardBackground,
    surfaceMuted: tokens.mutedBackground || tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    onPrimary: tokens.primaryForeground || '#FFFFFF',
    primary: tokens.primary || BUTTON_GREEN,
    destructive: tokens.destructive || BUTTON_RED,
});

const createArrivalStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
        },
        scrollContainer: {
            paddingHorizontal: 20,
            paddingTop: 32,
            paddingBottom: 120,
        },
        title: {
            fontSize: Fonts.f28,
            fontWeight: '700',
            color: palette.textPrimary,
            marginBottom: 24,
        },
        primaryActions: {
            marginBottom: 32,
        },
        primaryButton: {
            height: 60,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
        },
        primaryButtonDisabled: {
            opacity: 0.6,
        },
        primaryIcon: {
            marginRight: 14,
        },
        primaryLabel: {
            color: palette.onPrimary,
            fontSize: Fonts.f16,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        primaryButtonSpacing: {
            marginBottom: 16,
        },
        secondaryActions: {
            borderTopWidth: 1,
            borderTopColor: palette.border,
            paddingTop: 24,
        },
        secondaryButton: {
            height: 56,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surfaceMuted,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
        },
        secondaryButtonDisabled: {
            opacity: 0.6,
        },
        secondaryIcon: {
            marginRight: 12,
        },
        secondaryLabel: {
            color: palette.textPrimary,
            fontSize: Fonts.f16,
            fontWeight: '500',
        },
        secondaryButtonSpacing: {
            marginBottom: 16,
        },
        modalBackdrop: {
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        modalCard: {
            width: '100%',
            borderRadius: 16,
            backgroundColor: palette.surface,
            paddingHorizontal: 24,
            paddingVertical: 28,
            shadowColor: palette.textPrimary + '26',
            shadowOpacity: 0.2,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
        },
        modalTitle: {
            fontSize: Fonts.f18,
            fontWeight: '700',
            textAlign: 'center',
            color: palette.textPrimary,
            marginBottom: 24,
        },
        modalButtons: {
            gap: 12,
        },
        modalButton: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        modalButtonText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        modalCancel: {
            marginTop: 20,
            alignSelf: 'center',
        },
        modalCancelLabel: {
            fontSize: Fonts.f14,
            fontWeight: '500',
            color: palette.textSecondary,
        },
        alertBackdrop: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        alertCard: {
            width: '100%',
            borderRadius: 16,
            backgroundColor: palette.surface,
            paddingHorizontal: 24,
            paddingVertical: 28,
            alignItems: 'center',
            gap: 20,
        },
        alertTitle: {
            fontSize: Fonts.f22,
            fontWeight: '800',
            color: palette.textPrimary,
            textTransform: 'uppercase',
        },
        alertMessage: {
            fontSize: Fonts.f16,
            fontWeight: '500',
            color: palette.textPrimary,
            textAlign: 'center',
            lineHeight: 22,
        },
        alertButton: {
            minWidth: 160,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
        },
        alertButtonLabel: {
            fontSize: Fonts.f16,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
    });

const ArrivalCheckPage = (props) => (
    <ThemeProvider>
        <ArrivalCheckPageContent {...props} />
    </ThemeProvider>
);

export default ArrivalCheckPage;
