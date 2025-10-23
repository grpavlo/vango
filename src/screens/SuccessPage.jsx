import React, {useEffect} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';

const SuccessPage = ({  route, navigation }) => {
    const { clientSecretKey,token } = route.params|| {clientSecretKey:null,token:null};; // Retrieve clientSecretKey from navigation params


    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation]);


    return (
        <View style={styles.container}>
            <View style={styles.textContainer}>
                <Text style={styles.title}>Everything is fine!</Text>
                <Text style={styles.subtitle}>
                    Instructions for setting a new password have been sent to your email.
                </Text>
            </View>
            <Button title="Continue" onPress={() => navigation.navigate('NewPasswordPage', { clientSecretKey,token })} style={styles.continueButton} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
    },
    textContainer: {
        flex: 1,
        alignItems: 'flex-start',
        marginTop: 200,
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
        marginBottom: 30,
        textAlign: 'left',
    },
    continueButton: {
        position: 'absolute',
        bottom: '40%',
        alignSelf: 'center',

    },
});

export default SuccessPage;
