import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';
import {Ionicons} from "@expo/vector-icons";
const Input = ({ label, secureTextEntry, value, onChangeText, placeholder,  }) => {
    const [isPasswordVisible, setPasswordVisible] = useState(!secureTextEntry);

    return (
        <View style={styles.inputContainer}>
            <TextInput
                style={styles.input}
                secureTextEntry={secureTextEntry && !isPasswordVisible}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={Colors.blackText + '60'}
            />
            {secureTextEntry && (
                <TouchableOpacity
                    onPress={() => setPasswordVisible(!isPasswordVisible)}
                    style={styles.iconContainer}
                >
                    <Text style={styles.icon}>{isPasswordVisible ? <Ionicons name="eye-outline" size={24} color={Colors.blackText} />
                        : <Ionicons name="eye-off-outline" size={24} color={Colors.blackText} />
                    }</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({


    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.blackText + '30',
        borderRadius: 8,
        marginBottom: 10,
        paddingHorizontal: 10,
        backgroundColor: Colors.white,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: Fonts.f16,
        color: Colors.blackText,
    },
    iconContainer: {
        padding: 10,
    },
    icon: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
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
});

export default Input