import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView
} from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';
import Input from "../components/Input";
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {serverUrlApi} from "../const/api";

const LoginPage = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isButtonDisabled, setIsButtonDisabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const refreshTimeout = useRef(null);

    useEffect(() => {
        if (email && password) {
            setIsButtonDisabled(false);
        } else {
            setIsButtonDisabled(true);
        }
    }, [email, password]);

    const storeTokens = async (accessToken, refreshToken, userId) => {
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        await SecureStore.setItemAsync('userId', userId);

    };

    const scheduleRefresh = (expiresIn, currentRefreshToken) => {
        if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current);
        }
        refreshTimeout.current = setTimeout(() => {
            refreshToken(currentRefreshToken);
        }, expiresIn * 1000);
    };

    const refreshToken = async (currentRefreshToken) => {
        try {
            const response = await fetch(serverUrlApi+'auth/refresh', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: currentRefreshToken
                })
            });
            if (response.status === 200) {
                const data = await response.json();
                await storeTokens(data.accessToken, data.refreshToken, data.userId);
                scheduleRefresh(data.expiresIn, data.refreshToken);
            }else {
                navigation.navigate('SignIn');
            }
        } catch (error) {}
    };

    const handleSignIn = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const response = await fetch(serverUrlApi+'auth/login', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userName: email,
                    password: password
                })
            });
            if (response.status === 200) {
                const data = await response.json();
                await storeTokens(data.accessToken, data.refreshToken, data.userId);
                scheduleRefresh(data.expiresIn, data.refreshToken);
                navigation.navigate('RoutesPage');
            } else {
                setErrorMessage('Incorrect email or password.');
            }
        } catch (error) {
            console.log(error)
            setErrorMessage('An error occurred. Please try again.');
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <TouchableOpacity style={styles.backButton} onPress={() => {
                navigation.navigate('WelcomeScreen')
            }}>
                <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
                <Text style={styles.backText}> Back</Text>
            </TouchableOpacity>

            <View style={styles.containerMain}>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.subtitle}>Please log in into your account</Text>

                {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}

                <Input
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    secureTextEntry={false}
                />
                <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={true}
                />

                <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => {
                    navigation.navigate('ForgotPasswordPage')
                }}>
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="large" color={Colors.mainBlue} />
                ) : (
                    <Button
                        title="Sign in"
                        onPress={handleSignIn}
                        style={[
                            styles.signInButton,
                            isButtonDisabled && styles.disabledButton
                        ]}
                        disabled={isButtonDisabled}
                    />
                )}
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
    containerMain: {
        flex: 1,
        backgroundColor: Colors.white,
        justifyContent: "center",
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
    title: {
        fontSize: Fonts.f42,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 10,
    },
    errorText: {
        color: Colors.mainRed,
        fontSize: Fonts.f14,
        marginBottom: 10,
        textAlign: 'center',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f16,
    },
    signInButton: {
        marginTop: 10,
    },
    disabledButton: {
        backgroundColor: Colors.darkGray,
    },
});

export default LoginPage;
