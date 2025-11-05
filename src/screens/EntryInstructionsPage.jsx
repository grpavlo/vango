import React, {useEffect, useState} from 'react';
import {StyleSheet, View, TouchableOpacity, Text, SafeAreaView, ActivityIndicator} from 'react-native';
import {WebView} from 'react-native-webview';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import {Colors, Fonts} from '../utils/tokens';
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import {handleCallPress} from "../function/handleCallPress";
import {useInfoCheckpoint} from "../store/infoCheckpoint";
import {serverUrlApi} from "../const/api";

const EntryInstructionsPage = ({navigation, route}) => {
    const { menu,routeName } = route.params || {menu:true};
    const data = useInfoCheckpoint((state) => state.data);

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
        <View style={{
            flex: 1
        }}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.blackText} />
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
                            <Ionicons name="call" size={20} color={Colors.mainBlue} style={{marginRight: 5}}/>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.checkpointDetails}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color={Colors.mainRed}
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
                    <ActivityIndicator size="large" color={Colors.mainBlue} style={{ marginTop: 20 }} />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
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
        color: Colors.blackText,
    },
    containerWeb: {
        padding: 20
    },
    containerTime: {
        flexDirection: 'column',
    },
    webTitle: {
        fontSize: Fonts.f14,
        color: Colors.mainBlue,
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
        color: Colors.blackText,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    visitInfoText: {
        color: Colors.white,
        fontSize: Fonts.f14,
    },
    callIcon: {
        fontSize: Fonts.f20,
        color: Colors.mainBlue,
    },
    checkpointDetails: {
        borderBottomWidth: 0.5,
        borderTopWidth: 0.5,
        borderBottomColor: Colors.mainBlue,
        borderTopColor: Colors.mainBlue,
        paddingBottom: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,

    },
    checkpointAddressLabel: {
        fontSize: Fonts.f12,
        color: Colors.blackText + '60',
    },
    checkpointAddress: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
        marginBottom: 10,
    },
    pickupTimeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pickupTimeLabel: {
        fontSize: Fonts.f14,
        color: Colors.blackText + '60',
    },
    pickupTimeValue: {
        fontSize: Fonts.f16,
        color: Colors.blackText,
    },
    webView: {
        flex: 1,
        marginHorizontal: 20,
        borderRadius: 8,
        overflow: 'hidden',
    },
});

export default EntryInstructionsPage;
