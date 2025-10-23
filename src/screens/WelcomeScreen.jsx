// WelcomeScreen.jsx
import React, {useEffect, useState} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../utils/tokens';
import Button from "../components/Button";
import i18n from '../../i18n';
import BottomSheetSelect from "../components/SelectListCustom";
import * as SecureStore from 'expo-secure-store';

export default function WelcomeScreen({ navigation }) {

    const saveLanguage = async (token) => {
        try {
            await SecureStore.setItemAsync('Language', JSON.stringify(token));
        } catch (e) {
            console.error('error', e);
        }
    };

    const data = [
        { key: '1', value: 'English', label: 'English' },
        // { key: '2', value: 'Ukraine', label: 'Ukraine' },
    ];

    const [selectedItem, setSelectedItem] = useState({ key: '1', value: 'English', label: 'English' });

    useEffect(() => {
        const getToken = async () => {
            try {
                const token = await SecureStore.getItemAsync('Language');
                if(token){
                    setSelectedItem(JSON.parse(token))
                }
            } catch (e) {
                console.error('Не вдалося отримати токен', e);
                return null;
            }
        };
        getToken()
    }, []);

    const handleSelect = (item) => {
        setSelectedItem(item);
        saveLanguage(item)
    };

    return (
        <View style={[styles.container]}>
            <View style={styles.headerContainer}>
                <Text style={styles.mainTitle}>ROUTE</Text>
                <Text style={styles.mainTitle}>LOGS</Text>
                {/*<Text style={styles.mainTitle}>LAB</Text>*/}
                 <Text style={styles.subtitle}>{i18n.t('lets_get_started')}</Text>
            </View>

            <View style={styles.signInContainer}>
                <Text style={styles.sectionTitle}>Existing customer / Get started</Text>
                <Button title={'Sign in'} onPress={() => navigation.navigate('SignIn')} />
            </View>

            <View style={styles.languageContainer}>
                <Text style={styles.sectionTitle}>Choose the interface language</Text>
                <BottomSheetSelect
                    data={data}
                    onSelect={handleSelect}
                    placeholder=""
                    selectedValue={selectedItem?.value}
                />

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        paddingHorizontal: 24,
        justifyContent: 'space-between',
    },
    headerContainer: {
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    mainTitle: {
        fontSize: Fonts.f42,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-Bold',
        textAlign: 'left',
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        fontFamily: 'PlusJakartaSans-Regular',
        marginTop: 8,
    },
    signInContainer: {
        alignItems: 'flex-start',
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-SemiBold',
        marginBottom: 8,
        textAlign: 'center',
    },
    languageContainer: {
        alignItems: 'flex-start',
        marginBottom: 40,
    },
    selected: {
        marginTop: 16,
        fontSize: 16,
        color: 'green',
        textAlign: 'center',
    },
});
