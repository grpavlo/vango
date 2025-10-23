import React, {useEffect} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { Colors, Fonts } from '../utils/tokens';

const PasswordSetPage = ({ navigation }) => {

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            e.preventDefault();
        });

        return unsubscribe;
    }, [navigation]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>The new password set</Text>
            <Button title="Continue" onPress={() => navigation.navigate('SignIn')} style={styles.continueButton} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        backgroundColor: Colors.white,
        paddingHorizontal: 20,
    },
    title: {
        fontSize: Fonts.f42,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'left',
    },
    continueButton: {
        marginTop: 20,
    },
});

export default PasswordSetPage;
