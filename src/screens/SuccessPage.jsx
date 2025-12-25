import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { Fonts, createColorsFromTokens } from '../utils/tokens';
import { useDesignSystem } from "../context/ThemeContext";

const SuccessPage = ({ route, navigation }) => {
    const { clientSecretKey, token } = route.params || { clientSecretKey: null, token: null }; // Retrieve clientSecretKey from navigation params


    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation]);


    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <View style={styles.textContainer}>
                <Text style={styles.title}>Everything is fine!</Text>
                <Text style={styles.subtitle}>
                    Instructions for setting a new password have been sent to your email.
                </Text>
            </View>
            <Button title="Continue" onPress={() => navigation.navigate('NewPasswordPage', { clientSecretKey, token })} style={styles.continueButton} />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
    },
    textContainer: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    title: {
        fontSize: Fonts.f42,
        color: colors.primary,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: colors.textSecondary,
        marginBottom: 30,
        textAlign: 'left',
    },
    continueButton: {
        marginBottom: 40,
    },
});

export default SuccessPage;
