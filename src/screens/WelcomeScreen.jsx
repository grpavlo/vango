// WelcomeScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts, createColorsFromTokens } from '../utils/tokens';
import Button from "../components/Button";
import i18n from '../../i18n';
import BottomSheetSelect from "../components/SelectListCustom";
import * as SecureStore from 'expo-secure-store';
import { useDesignSystem } from "../context/ThemeContext";

export default function WelcomeScreen({ navigation }) {
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                if (token) {
                    setSelectedItem(JSON.parse(token));
                }
            } catch (e) {
                console.error('Failed to load saved language', e);
                return null;
            }
        };
        getToken();
    }, []);

    const handleSelect = (item) => {
        setSelectedItem(item);
        saveLanguage(item);
    };

    return (
        <View style={styles.container}>
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

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 24,
        paddingVertical: 48,
        justifyContent: 'space-between',
    },
    headerContainer: {
        alignItems: 'flex-start',
    },
    mainTitle: {
        fontSize: Fonts.f42,
        color: colors.primary,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-Bold',
        textAlign: 'left',
    },
    subtitle: {
        fontSize: Fonts.f16,
        color: colors.textSecondary,
        fontFamily: 'PlusJakartaSans-Regular',
        marginTop: 8,
    },
    signInContainer: {
        alignItems: 'flex-start',
        marginTop: 40,
    },
    sectionTitle: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        fontWeight: 'bold',
        fontFamily: 'PlusJakartaSans-SemiBold',
        marginBottom: 12,
        textAlign: 'center',
    },
    languageContainer: {
        alignItems: 'flex-start',
    },
    selected: {
        marginTop: 16,
        fontSize: 16,
        color: colors.primary,
        textAlign: 'center',
    },
});
