import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';
import { Fonts } from '../utils/tokens';
import { handleCallPress } from '../function/handleCallPress';
import { useAppAlert } from '../hooks/useAppAlert';

const BUTTONS = [
    {
        key: 'contactOffice',
        label: 'Contact Office',
        icon: 'business-outline',
        action: 'office',
    },
    {
        key: 'callDispatch',
        label: 'Call Dispatch',
        icon: 'call-outline',
        action: 'dispatchCall',
    },
    {
        key: 'textDispatch',
        label: 'Text Dispatch',
        icon: 'chatbubble-ellipses-outline',
        action: 'dispatchText',
    },
    {
        key: 'shareLocation',
        label: 'Share My Location',
        icon: 'location-outline',
        action: 'shareLocation',
    },
];

const ArrivalHelpPageContent = ({ navigation, route }) => {
    const { tokens } = useDesignSystem();
    const { showAlert } = useAppAlert();
    const palette = useMemo(() => createHelpPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);

    const { officePhone = null, dispatchPhone = null, idRoute = null } = route.params || {};

    const handleButtonPress = (action) => {
        switch (action) {
            case 'office':
                if (officePhone) {
                    handleCallPress(officePhone);
                }
                break;
            case 'dispatchCall':
                if (dispatchPhone) {
                    handleCallPress(dispatchPhone);
                }
                break;
            case 'dispatchText':
                navigation.navigate('ChatComponent', { menu: false, idRoute });
                break;
            case 'shareLocation':
                showAlert({
                    title: 'Share Location',
                    message: 'Location sharing is coming soon. Contact dispatch if you need immediate assistance.',
                    variant: 'info',
                });
                break;
            default:
                break;
        }
    };

    const isDisabled = (action) => {
        if (action === 'office') {
            return !officePhone;
        }
        if (action === 'dispatchCall') {
            return !dispatchPhone;
        }
        if (action === 'dispatchText') {
            return !idRoute;
        }
        return false;
    };

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Help</Text>
                    <View style={styles.backButtonPlaceholder} />
                </View>

                <View style={styles.actionsContainer}>
                    {BUTTONS.map((button, index) => {
                        const disabled = isDisabled(button.action);
                        return (
                            <TouchableOpacity
                                key={button.key}
                                style={[
                                    styles.actionButton,
                                    disabled && styles.actionButtonDisabled,
                                    index === BUTTONS.length - 1 && styles.lastButton,
                                ]}
                                onPress={() => handleButtonPress(button.action)}
                                activeOpacity={disabled ? 1 : 0.85}
                                disabled={disabled}
                            >
                                <Ionicons
                                    name={button.icon}
                                    size={20}
                                    color={disabled ? palette.iconMuted : palette.iconActive}
                                    style={styles.actionIcon}
                                />
                                <Text
                                    style={[
                                        styles.actionLabel,
                                        disabled && styles.actionLabelDisabled,
                                    ]}
                                >
                                    {button.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <BottomNavigationMenu navigation={navigation} activeTab="Route" />
        </View>
    );
};

const createHelpPalette = (tokens) => ({
    background: tokens.background,
    card: tokens.cardBackground,
    textPrimary: tokens.textPrimary,
    textMuted: tokens.textSecondary,
    border: tokens.border,
    iconActive: tokens.primary,
    iconMuted: tokens.textSecondary,
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
            paddingBottom: 120,
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
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.border,
        },
        backButtonPlaceholder: {
            width: 36,
            height: 36,
        },
        headerTitle: {
            flex: 1,
            textAlign: 'center',
            fontSize: Fonts.f20,
            fontWeight: '700',
            color: palette.textPrimary,
        },
        actionsContainer: {
            gap: 12,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 18,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.border,
            shadowColor: palette.textPrimary + '14',
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
        },
        actionButtonDisabled: {
            opacity: 0.5,
        },
        lastButton: {
            marginBottom: 8,
        },
        actionIcon: {
            marginRight: 12,
        },
        actionLabel: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            color: palette.textPrimary,
        },
        actionLabelDisabled: {
            color: palette.textMuted,
        },
    });

const ArrivalHelpPage = (props) => (
    <ThemeProvider>
        <ArrivalHelpPageContent {...props} />
    </ThemeProvider>
);

export default ArrivalHelpPage;
