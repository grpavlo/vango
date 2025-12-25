import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, View, TouchableOpacity, Text, SafeAreaView, ActivityIndicator} from 'react-native';
import {WebView} from 'react-native-webview';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import {Fonts, createColorsFromTokens, withAlpha} from '../utils/tokens';
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import {handleCallPress} from "../function/handleCallPress";
import {useInfoCheckpoint} from "../store/infoCheckpoint";
import {serverUrlApi} from "../const/api";
import {useDesignSystem} from "../context/ThemeContext";

const EntryInstructionsPage = ({navigation, route}) => {
    const { menu,routeName } = route.params || {menu:true};
    const data = useInfoCheckpoint((state) => state.data);
    const {tokens} = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [instructionsHTML, setInstructionsHTML] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');


    useEffect(() => {
        const fetchInstructions = async () => {
            if (!data || !data.id) {
                setErrorMessage('Invalid checkpoint data.');
                setLoading(false);
                return;
            }

            try {
                const accessToken = await SecureStore.getItemAsync('accessToken');
                if (!accessToken) {
                    setErrorMessage('Authentication token is missing. Please log in again.');
                    setLoading(false);
                    return;
                }

                const response = await fetch(serverUrlApi+`visits/${data.id}/info`, {
                    method: 'GET',
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (response.status === 200) {
                    const result = await response.json();
                    // Assuming the endpoint returns HTML content. If it returns JSON, adjust accordingly.
                    setInstructionsHTML(result || '<p>No instructions available.</p>');
                } else if (response.status === 401) {
                    setErrorMessage('Unauthorized access. Please log in again.');
                } else if (response.status === 404) {
                    setErrorMessage('Instructions not found.');
                } else {
                    setErrorMessage('Failed to fetch entry instructions.');
                }
            } catch (error) {
                setErrorMessage('An error occurred while fetching instructions. Please try again.');
            }
            setLoading(false);
        };

        fetchInstructions();
    }, [data]);

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.checkpointHeader}>
                    <Text style={styles.checkpointTitle}>{routeName}</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.visitInfoButton}>
                            <Text style={styles.visitInfoText}>Visit Info</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={()=>handleCallPress(data.phone)}>
                            <Ionicons name="call" size={20} color={colors.primary} style={{marginRight: 5}}/>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.checkpointDetails}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.destructive}
                                            style={{marginRight: 5}}/>
                    <View style={styles.infoRowNext}>
                        <Text style={styles.checkpointAddressLabel}>Checkpoint Address</Text>
                        <Text style={styles.checkpointAddress}>{data.address}</Text>
                        <View style={styles.pickupTimeContainer}>
                            <View style={styles.containerTime}>
                                <Text style={styles.pickupTimeLabel}>PickUP time</Text>
                                <Text style={styles.pickupTimeValue}>{data.hours}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.containerWeb}>
                    <Text style={styles.webTitle}>ENTRY INSTRUCTIONS</Text>
                </View>


                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
                ) : errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                ) : (
                    <WebView
                        style={styles.webView}
                        originWhitelist={['*']}
                        source={{ html: instructionsHTML }}
                    />
                )}

            </View>
            {menu && <BottomNavigationMenu navigation={navigation} activeTab="Route"/>}
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontSize: Fonts.f14,
        color: colors.textPrimary,
    },
    containerWeb: {
        padding: 20
    },
    containerTime: {
        flexDirection: 'column',
    },
    webTitle: {
        fontSize: Fonts.f14,
        color: colors.primary,
        fontWeight: '600',
    },
    checkpointHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    infoRowNext: {
        marginBottom: 10,
        flexDirection: 'column',
        alignItems: 'flex-start',
        width:"90%"
    },
    checkpointTitle: {
        fontSize: Fonts.f20,
        color: colors.textPrimary,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    visitInfoButton: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: withAlpha(colors.primary, '12'),
        marginRight: 12,
    },

    visitInfoText: {
        color: colors.primaryForeground,
        fontSize: Fonts.f14,
        fontWeight: '600',
    },
    callIcon: {
        fontSize: Fonts.f20,
        color: colors.primary,
    },
    checkpointDetails: {
        borderBottomWidth: 0.5,
        borderTopWidth: 0.5,
        borderBottomColor: colors.border,
        borderTopColor: colors.border,
        paddingBottom: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
        backgroundColor: colors.surface,
        borderRadius: 12,
    },
    checkpointAddressLabel: {
        fontSize: Fonts.f12,
        color: withAlpha(colors.textPrimary, '60'),
    },
    checkpointAddress: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
        marginBottom: 10,
    },
    pickupTimeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pickupTimeLabel: {
        fontSize: Fonts.f14,
        color: withAlpha(colors.textPrimary, '60'),
    },
    pickupTimeValue: {
        fontSize: Fonts.f16,
        color: colors.textPrimary,
    },
    webView: {
        flex: 1,
        marginHorizontal: 20,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.surface,
    },
});

export default EntryInstructionsPage;
