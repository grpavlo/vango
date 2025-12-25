import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Fonts, createColorsFromTokens, withAlpha } from '../utils/tokens';
import { Ionicons } from "@expo/vector-icons";
import { useDesignSystem } from "../context/ThemeContext";

const createStyles = (colors) => StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: withAlpha(colors.textPrimary, '30'),
        borderRadius: 8,
        marginBottom: 10,
        paddingHorizontal: 10,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: Fonts.f16,
        color: colors.textPrimary,
    },
    iconContainer: {
        padding: 10,
    },
    icon: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: colors.primary,
        fontSize: Fonts.f16,
    },
    signInButton: {
        marginTop: 10,
    },
});

const Input = ({ label, secureTextEntry, value, onChangeText, placeholder,  }) => {
    const [isPasswordVisible, setPasswordVisible] = useState(!secureTextEntry);
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.inputContainer}>
            <TextInput
                style={styles.input}
                secureTextEntry={secureTextEntry && !isPasswordVisible}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={withAlpha(colors.textPrimary, '60')}
            />
            {secureTextEntry && (
                <TouchableOpacity
                    onPress={() => setPasswordVisible(!isPasswordVisible)}
                    style={styles.iconContainer}
                >
                    <Text style={styles.icon}>{isPasswordVisible ? <Ionicons name="eye-outline" size={24} color={colors.textPrimary} />
                        : <Ionicons name="eye-off-outline" size={24} color={colors.textPrimary} />
                    }</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default Input
