import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import Button from '../components/Button';
import { Fonts, createColorsFromTokens, withAlpha } from '../utils/tokens';
import { Ionicons } from '@expo/vector-icons';
import { serverUrlApi } from "../const/api";
import { useAppAlert } from '../hooks/useAppAlert';
import { useDesignSystem } from "../context/ThemeContext";

const ForgotPasswordPage = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAppAlert();
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Function to generate a random clientSecretKey
    const generateClientSecretKey = (length = 32) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < length; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    };

    // Function to handle the Continue button press
    const handleContinue = async () => {
        if (email.trim() === '') {
            showAlert({
                title: 'Validation Error',
                message: 'Please enter your email address.',
                variant: 'warning',
            });
            return;
        }

        setLoading(true);

        const clientSecretKey = generateClientSecretKey();

        try {
            const response = await fetch(serverUrlApi+'auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    clientSecretKey: clientSecretKey,
                }),
            });

            if (response.status === 200) {
                // Optionally, you can parse the response if needed
                // const data = await response.json();
                navigation.navigate('VerificationCodePage', { clientSecretKey });
            } else {
                const errorData = await response.json();
                showAlert({
                    title: 'Error',
                    message: errorData.message || 'Something went wrong. Please try again.',
                    variant: 'error',
                });
            }
        } catch (error) {
            showAlert({
                title: 'Network Error',
                message: 'Unable to connect to the server. Please check your internet connection and try again.',
                variant: 'error',
            });
            console.error('Forgot Password Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} >
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.contentContainer}>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>
                    Enter your email for the verification process, we will send a code to your email
                </Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your email here..."
                        placeholderTextColor={withAlpha(colors.textPrimary, '60')}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <Button
                    title={loading ? <ActivityIndicator color={colors.primaryForeground} /> : "Continue"}
                    onPress={handleContinue}
                    disabled={loading}
                    style={styles.continueButton}
                />
            </View>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backText: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginLeft: 5,
    },
    contentContainer: {
        flex: 1,
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
        marginBottom: 20,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginBottom: 5,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: withAlpha(colors.textPrimary, '30'),
        borderRadius: 8,
        paddingHorizontal: 14,
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
    },
    continueButton: {
        marginTop: 10,
    },
});

export default ForgotPasswordPage;
