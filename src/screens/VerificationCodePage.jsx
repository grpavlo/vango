import React, { useRef, useState } from 'react';
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
import { Colors, Fonts } from '../utils/tokens';
import SuccessPage from "./SuccessPage";
import {serverUrlApi} from "../const/api";
import { useAppAlert } from '../hooks/useAppAlert';

const VerificationCodePage = ({ route, navigation }) => {
    const { clientSecretKey } = route.params || { clientSecretKey: null }; // Retrieve clientSecretKey from navigation params

    const [code, setCode] = useState(['', '', '', '']);
    const inputs = useRef([]);
    const [isLoading, setIsLoading] = useState(false);
    const { showAlert } = useAppAlert();

    const handleChangeText = (value, index) => {
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        if (value && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && index > 0 && code[index] === '') {
            inputs.current[index - 1].focus();
        }
    };

    const handleConfirm = async () => {
        const enteredCode = code.join('');

        // Basic validation to ensure all digits are entered
        if (enteredCode.length < 4) {
            showAlert({
                title: 'Invalid Code',
                message: 'Please enter all 4 digits of the code.',
                variant: 'error',
            });
            return;
        }

        setIsLoading(true);


        try {
            const response = await fetch(serverUrlApi+'auth/validate-code', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: enteredCode,
                    clientSecretKey: clientSecretKey,
                }),
            });
            // console.log(data)
            if (response.status === 200) {
                // Assuming the response contains JSON data
                const data = await response.json();
                // Navigate to SuccessPage and pass clientSecretKey
                navigation.navigate('SuccessPage', { clientSecretKey,token:data });
            } else if (response.status === 400) {
                // Handle invalid code
                showAlert({
                    title: 'Invalid Code',
                    message: 'The code you entered is incorrect. Please try again.',
                    variant: 'error',
                });
            } else {
                // Handle other possible errors
                showAlert({
                    title: 'Error',
                    message: 'Something went wrong. Please try again later.',
                    variant: 'error',
                });
            }
        } catch (error) {
            console.error('Error validating code:', error);
            showAlert({
                title: 'Network Error',
                message: 'Unable to validate the code. Please check your internet connection and try again.',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} >
            <Text style={styles.title}>Enter 4-digit Code</Text>
            <Text style={styles.subtitle}>
                A four-digit code should have been sent to your email address.
            </Text>

            <View style={styles.codeInputContainer}>
                {code.map((digit, index) => (
                    <TextInput
                        key={index}
                        ref={(el) => (inputs.current[index] = el)}
                        style={styles.codeInput}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={digit}
                        onChangeText={(value) => handleChangeText(value, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        returnKeyType={index === 3 ? 'done' : 'next'}
                        onSubmitEditing={() => {
                            if (index === 3) {
                                handleConfirm();
                            } else {
                                inputs.current[index + 1].focus();
                            }
                        }}
                    />
                ))}
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color={Colors.mainBlue} />
            ) : (
                <View style={styles.buttonContainer}>
                    <Button title="Confirm" onPress={handleConfirm} style={styles.confirmButton} />
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
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
        textAlign: 'center',
    },
    codeInputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: 20,
    },
    codeInput: {
        height: 60,
        width: 60,
        borderWidth: 1,
        borderColor: Colors.blackText + '30',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: Fonts.f23,
        color: Colors.blackText,
        backgroundColor: Colors.white,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '80%',
    },
    confirmButton: {
        flex: 1,
        marginRight: 10,
    },
    cancelButton: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: Colors.mainBlue,
        borderRadius: 8,
    },
    cancelButtonText: {
        color: Colors.mainBlue,
        fontSize: Fonts.f16,
    },
});

export default VerificationCodePage;
