import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';
import { Ionicons } from '@expo/vector-icons';
import {serverUrlApi} from "../const/api";

const ForgotPasswordPage = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

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
            Alert.alert('Validation Error', 'Please enter your email address.');
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
                Alert.alert('Error', errorData.message || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            Alert.alert('Network Error', 'Unable to connect to the server. Please check your internet connection and try again.');
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
                <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
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
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor={Colors.blackText + '60'}
                    />
                </View>

                <Button
                    title={loading ? <ActivityIndicator color={Colors.white} /> : "Continue"}
                    onPress={handleContinue}
                    disabled={loading}
                    style={styles.continueButton}
                />
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backText: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginLeft: 5,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: Fonts.f42,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 20,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 5,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: Colors.blackText + '30',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: Fonts.f16,
        color: Colors.blackText,
        backgroundColor: Colors.white,
    },
    continueButton: {
        marginTop: 10,
        backgroundColor: Colors.mainBlue, // Ensure the button has a background color
    },
});

export default ForgotPasswordPage;
