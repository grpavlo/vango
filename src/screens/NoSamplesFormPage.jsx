import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useDesignSystem } from '../context/ThemeContext';
import { Fonts } from '../utils/tokens';

const NoSamplesFormPageContent = ({ navigation, route }) => {
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

    const [personName, setPersonName] = useState('');
    const [note, setNote] = useState('');

    const handleTakePictures = useCallback(() => {
        navigation.navigate('TakeMediaPage', {
            routeName,
            idRoute,
            idCheckpoint,
            dispatchPhone,
            officePhone,
        });
    }, [navigation, routeName, idRoute, idCheckpoint, dispatchPhone, officePhone]);

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
                <Text style={styles.headerTitle}>No Samples Available</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Name of the person you spoke with</Text>
                    <TextInput
                        value={personName}
                        onChangeText={setPersonName}
                        placeholder="Enter person's name"
                        placeholderTextColor={palette.textMuted}
                        style={styles.textInput}
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Note</Text>
                    <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="Add any additional notes..."
                        placeholderTextColor={palette.textMuted}
                        multiline
                        numberOfLines={5}
                        style={styles.textArea}
                    />
                </View>

                <Text style={styles.nextStepLabel}>Next step:</Text>

                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: palette.primary }]}
                    onPress={handleTakePictures}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.primaryButtonText, { color: palette.onPrimary }]}>TAKE PICTURES</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleHelp}
                    activeOpacity={0.85}
                >
                    <Text style={styles.secondaryButtonText}>HELP</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const createPalette = (tokens) => ({
    background: tokens.background,
    card: tokens.cardBackground,
    border: tokens.border,
    textPrimary: tokens.textPrimary,
    textMuted: tokens.textSecondary,
    primary: tokens.primary,
    onPrimary: tokens.primaryForeground || '#FFFFFF',
});

const createStyles = (palette) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: palette.background,
            paddingHorizontal: 20,
            paddingTop: 16,
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
            paddingBottom: 40,
            gap: 20,
        },
        fieldGroup: {
            gap: 8,
        },
        label: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.textPrimary,
        },
        textInput: {
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: Fonts.f16,
            color: palette.textPrimary,
            backgroundColor: palette.card,
        },
        textArea: {
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: Fonts.f16,
            color: palette.textPrimary,
            backgroundColor: palette.card,
            minHeight: 120,
            textAlignVertical: 'top',
        },
        nextStepLabel: {
            fontSize: Fonts.f14,
            fontWeight: '600',
            color: palette.textPrimary,
            textTransform: 'uppercase',
        },
        primaryButton: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryButtonText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            letterSpacing: 0.5,
        },
        secondaryButton: {
            height: 52,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
        },
        secondaryButtonText: {
            fontSize: Fonts.f16,
            fontWeight: '600',
            color: palette.textPrimary,
        },
    });

const NoSamplesFormPage = (props) => (
    <ThemeProvider>
        <NoSamplesFormPageContent {...props} />
    </ThemeProvider>
);

export default NoSamplesFormPage;
