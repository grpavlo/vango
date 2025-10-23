import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal } from 'react-native';
import { Fonts } from '../utils/tokens';
import { useDesignSystem } from '../context/ThemeContext';

const UniversalModal = ({
    visible,
    onConfirm,
    onCancel,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
}) => {
    const { tokens } = useDesignSystem();
    const palette = useMemo(() => createModalPalette(tokens), [tokens]);
    const styles = useMemo(() => createStyles(palette), [palette]);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onCancel}
        >
            {/*<StatusBar animated backgroundColor={ 'rgba(0, 0, 0, 0.5)'} />*/}

            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    {title && <Text style={styles.modalTitle}>{title}</Text>}
                    {description && <Text style={styles.modalDescription}>{description}</Text>}
                    <View style={styles.modalButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalConfirmButton]}
                            onPress={onConfirm}
                        >
                            <Text style={styles.modalButtonText}>{confirmText}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.modalCancelButton]}
                            onPress={onCancel}
                        >
                            <Text style={styles.modalCancelButtonText}>{cancelText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const createModalPalette = (tokens) => ({
    overlay: tokens.overlay || 'rgba(0, 0, 0, 0.5)',
    background: tokens.cardBackground,
    primary: tokens.primary,
    primaryForeground: tokens.primaryForeground || '#FFFFFF',
    textPrimary: tokens.textPrimary,
    textSecondary: tokens.textSecondary,
    border: tokens.border,
});

const createStyles = (palette) =>
    StyleSheet.create({
        modalContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: palette.overlay,
            paddingHorizontal: 20,
        },
        modalContent: {
            width: '100%',
            backgroundColor: palette.background,
            borderRadius: 16,
            padding: 24,
            alignItems: 'flex-start',
            shadowColor: palette.textPrimary + '25',
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 8,
        },
        modalTitle: {
            fontSize: Fonts.f18,
            fontWeight: '700',
            color: palette.textPrimary,
            marginBottom: 12,
        },
        modalDescription: {
            fontSize: Fonts.f14,
            color: palette.textSecondary,
            textAlign: 'left',
            marginBottom: 24,
        },
        modalButtonsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
        },
        modalButton: {
            flex: 1,
            marginHorizontal: 6,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 12,
        },
        modalConfirmButton: {
            backgroundColor: palette.primary,
        },
        modalCancelButton: {
            borderWidth: 1,
            borderColor: palette.primary,
        },
        modalButtonText: {
            color: palette.primaryForeground,
            fontSize: Fonts.f16,
            fontWeight: '700',
        },
        modalCancelButtonText: {
            color: palette.primary,
            fontSize: Fonts.f16,
            fontWeight: '700',
        },
    });

export default UniversalModal;

