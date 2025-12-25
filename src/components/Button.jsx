import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Fonts, createColorsFromTokens, withAlpha } from '../utils/tokens';
import { useDesignSystem } from '../context/ThemeContext';

const Button = ({ title, onPress, style, disabled }) => {
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <TouchableOpacity
            style={[
                styles.button,
                style,
                disabled && styles.disabled
            ]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={styles.buttonText}>{title}</Text>
        </TouchableOpacity>
    );
};

const createStyles = (colors) => StyleSheet.create({
    button: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: withAlpha(colors.textPrimary, '40'),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
        width: "100%"
    },
    buttonText: {
        color: colors.primaryForeground,
        fontSize: Fonts.f16,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-SemiBold',
    },
    disabled: {
        backgroundColor: withAlpha(colors.primary, '50'),
    },
});

export default Button;
