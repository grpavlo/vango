import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../utils/tokens';

const Button = ({ title, onPress, style, disabled }) => {
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

const styles = StyleSheet.create({
    button: {
        backgroundColor: Colors.mainBlue,
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
        width:"100%"
    },
    buttonText: {
        color: Colors.white,
        fontSize: Fonts.f16,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-SemiBold',
    },
    disabled: {
        backgroundColor: Colors.darkGray,
    },
});

export default Button;
