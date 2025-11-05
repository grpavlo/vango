import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppAlertStore } from '../store/useAppAlertStore';
import { useDesignSystem } from '../context/ThemeContext';

const variantIcons = {
    info: 'information-circle',
    success: 'checkmark-circle',
    warning: 'warning',
    error: 'close-circle',
};

const withAlpha = (hex, alpha) => {
    if (typeof hex !== 'string' || !hex.startsWith('#')) {
        return hex;
    }
    const base = hex.length === 9 ? hex.slice(0, 7) : hex;
    return `${base}${alpha}`;
};

const buildPalette = (tokens, variant) => {
    const accents = {
        info: tokens.primary,
        success: tokens.primary,
        warning: '#F59E0B',
        error: tokens.destructive,
    };

    return {
        overlay: tokens.overlay || 'rgba(0, 0, 0, 0.5)',
        background: tokens.cardBackground,
        textPrimary: tokens.textPrimary,
        textSecondary: tokens.textSecondary,
        border: tokens.border,
        confirmBackground: tokens.primary,
        confirmForeground: tokens.primaryForeground || '#FFFFFF',
        cancelText: tokens.textSecondary,
        cancelBorder: tokens.border,
        accent: accents[variant] || tokens.primary,
    };
};

const createStyles = (palette, typography) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: palette.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
        },
        container: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: palette.background,
            borderRadius: 18,
            padding: 24,
            shadowColor: palette.accent,
            shadowOpacity: 0.16,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 18 },
            elevation: 12,
        },
        iconWrapper: {
            alignSelf: 'flex-start',
            width: 48,
            height: 48,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: withAlpha(palette.accent, '1A'),
            marginBottom: 16,
        },
        title: {
            fontSize: typography.sizes.title,
            fontWeight: typography.weights.semibold,
            color: palette.textPrimary,
            marginBottom: 8,
        },
        message: {
            fontSize: typography.sizes.body,
            color: palette.textSecondary,
            marginBottom: 24,
        },
        actions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
        },
        button: {
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 12,
        },
        confirmButton: {
            backgroundColor: palette.confirmBackground,
        },
        confirmText: {
            color: palette.confirmForeground,
            fontSize: typography.sizes.button,
            fontWeight: typography.weights.semibold,
        },
        cancelButton: {
            borderWidth: 1,
            borderColor: palette.cancelBorder,
            marginRight: 12,
        },
        cancelText: {
            color: palette.cancelText,
            fontSize: typography.sizes.button,
            fontWeight: typography.weights.semibold,
        },
    });

const AppAlertHost = () => {
    const { tokens, typography } = useDesignSystem();
    const visible = useAppAlertStore((state) => state.visible);
    const title = useAppAlertStore((state) => state.title);
    const message = useAppAlertStore((state) => state.message);
    const confirmText = useAppAlertStore((state) => state.confirmText);
    const cancelText = useAppAlertStore((state) => state.cancelText);
    const variant = useAppAlertStore((state) => state.variant);
    const onConfirm = useAppAlertStore((state) => state.onConfirm);
    const onCancel = useAppAlertStore((state) => state.onCancel);
    const dismissible = useAppAlertStore((state) => state.dismissible);
    const hideAlert = useAppAlertStore((state) => state.hideAlert);

    const palette = useMemo(() => buildPalette(tokens, variant), [tokens, variant]);
    const styles = useMemo(() => createStyles(palette, typography), [palette, typography]);
    const iconName = variantIcons[variant] || variantIcons.info;

    const handleDismiss = () => {
        if (dismissible) {
            hideAlert();
        }
    };

    const handleConfirm = () => {
        hideAlert();
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    };

    const handleCancel = () => {
        hideAlert();
        if (typeof onCancel === 'function') {
            onCancel();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleDismiss}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.iconWrapper}>
                        <Ionicons name={iconName} size={28} color={palette.accent} />
                    </View>
                    {title ? <Text style={styles.title}>{title}</Text> : null}
                    {message ? <Text style={styles.message}>{message}</Text> : null}
                    <View style={styles.actions}>
                        {cancelText ? (
                            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
                            <Text style={styles.confirmText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default AppAlertHost;
