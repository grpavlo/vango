import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    Alert
} from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';
import Input from "../components/Input";
import {serverUrlApi} from "../const/api";

const NewPasswordPage = ({ route, navigation }) => {
    const { clientSecretKey, token } = route.params || {}; // Retrieve clientSecretKey and token from navigation params

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordVisible, setPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleContinue = async () => {
        // Validation: Check if both fields are filled
        if (!password || !confirmPassword) {
            Alert.alert('Incomplete Fields', 'Please fill in both password fields.');
            return;
        }

        // Validation: Check if passwords match
        if (password !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
            return;
        }

        setIsLoading(true);


        try {
            const response = await fetch(serverUrlApi+'auth/change-password', {
                method: 'POST',
                headers: {
                    'Accept': '*/*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    password: password,
                    token: token,
                }),
            });

            if (response.status === 200) {
                // Assuming the response contains JSON data
                // const data = await response.json();
                // Navigate to PasswordSetPage
                navigation.navigate('PasswordSetPage', { clientSecretKey });
            } else if (response.status === 400) {
                // Handle invalid token or other client errors
                Alert.alert('Error', 'Unable to change password. Please try again.');
            } else {
                // Handle other possible errors
                Alert.alert('Error', 'Something went wrong. Please try again later.');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            Alert.alert('Network Error', 'Unable to change the password. Please check your internet connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Enter New Password</Text>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!isPasswordVisible}
                    // Optionally, add a toggle for visibility
                />
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <Input
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!isConfirmPasswordVisible}
                    // Optionally, add a toggle for visibility
                />
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={Colors.mainBlue} />
            ) : (
                <Button
                    title="Continue"
                    onPress={handleContinue}
                    style={styles.continueButton}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: Fonts.f42,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'left',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 5,
    },
    continueButton: {
        marginTop: 20,
    },
});

export default NewPasswordPage;
