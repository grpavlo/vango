import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { Fonts, createColorsFromTokens } from '../utils/tokens';
import { useDesignSystem } from "../context/ThemeContext";

const PasswordSetPage = ({ navigation }) => {

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
            <Text style={styles.title}>The new password set</Text>
            <Button title="Continue" onPress={() => navigation.navigate('SignIn')} style={styles.continueButton} />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        backgroundColor: colors.background,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: Fonts.f42,
        color: colors.primary,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'left',
    },
    continueButton: {
        marginTop: 20,
    },
});

export default PasswordSetPage;
