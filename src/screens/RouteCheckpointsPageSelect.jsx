import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import UniversalModal from '../components/UniversalModal';
import { Fonts, createColorsFromTokens, withAlpha } from '../utils/tokens';
import CheckpointItem from "../components/CheckpointItem";
import * as SecureStore from 'expo-secure-store';
import { formatDuration } from "../function/function";
import { useRouteStore } from "../store/useRouteStore";
import { useInfoCheckpoint } from "../store/infoCheckpoint";
import { serverUrlApi } from "../const/api";
import { useDesignSystem } from "../context/ThemeContext";

function formatDateString(dateString) {
    const date = new Date(dateString);
    const dayName = date.toLocaleString('en-US', {weekday: 'short'});
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${dayName}, ${month}/${day}/${year}`;
}

const RouteCheckpointsPageSelect = ({ navigation, route }) => {
    const { idRoute, idCheckpoint } = route.params || { idRoute: null };
    const [modalVisible, setModalVisible] = useState(false);
    const [finishModalVisible, setFinishModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [routeDetails, setRouteDetails] = useState({
        id: '',
        name: '',
        started: false,
        startDate: '',
        endDate: '',
        duration: '',
    });
    // Точка з isDefaultUnload, яку покажемо окремо
    const [unloadCheckpoint, setUnloadCheckpoint] = useState(null);

    // Списки точок (не виконані/виконані), без урахування isDefaultUnload
    const [checkpointsMain, setCheckpointsMain] = useState([]);
    const [checkpointsMainCompleted, setCheckpointsMainCompleted] = useState([]);

    const routeChangeReason = useRouteStore((state) => state.routeChangeReason);
    const setData = useInfoCheckpoint((state) => state.setData);
    const data = useInfoCheckpoint((state) => state.data);
    const { tokens } = useDesignSystem();
    const colors = useMemo(() => createColorsFromTokens(tokens), [tokens]);
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        async function setIdRoute() {
            if(idRoute){
                await SecureStore.setItemAsync('idRoute', String(idRoute));
            }else{
                await SecureStore.deleteItemAsync('idRoute');
            }
        }
        setIdRoute()
    }, [idRoute]);

    const fetchRoute = async () => {
        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                setErrorMessage('Authentication token is missing. Please log in again.');
                setLoading(false);
                return;
            }

            const response = await fetch(serverUrlApi + `routes/${idRoute}`, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });


            if (response.status === 200) {
                const data = await response.json();

                // Форматуємо дати і тривалість
                const formattedStartDate = formatDateString(data.startDate);
                const formattedEndDate = formatDateString(data.endDate);
                const finalDuration = formatDuration(data.estimatedDuration);

                setRouteDetails({
                    id: data.id,
                    name: data.name,
                    started: data.started,
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    duration: finalDuration,
                });

                const transformVisit = (visit, index, arr) => {
                    const startTimeDate = new Date(0);
                    startTimeDate.setSeconds(visit.startTime);
                    const endTimeDate = new Date(0);
                    endTimeDate.setSeconds(visit.endTime);
                    const startHours = startTimeDate.toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    const endHours = endTimeDate.toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    let color = 'gray';
                    if (visit.flag === 1) color = 'red';
                    if (visit.flag === 2) color = 'yellow';
                    if (visit.flag === 3) color = 'green';
                    if (visit.flag === 4) color = 'blue';

                    return {
                        ...visit,
                        id: visit.id,
                        type: visit.dropOff ? 'unloading' : 'loading',
                        name: visit.checkpointName,
                        address: `${visit.address}${visit.city ? ', ' + visit.city : ''}${visit.state ? ', ' + visit.state : ''}${visit.zipCode ? ', ' + visit.zipCode : ''}`,
                        hours: `${startHours} - ${endHours}`,
                        flagColor: color,
                        stat: visit.priority ? 'STAT' : null,
                        count: index + 1,
                        last: ((index + 1 === arr.length) && visit.dropOff)
                    };
                };

                // Формуємо списки visits та completedVisits
                const visitsData = (data.visits || []).map((v, idx, arr) => transformVisit(v, idx, arr));
                const completedData = (data.completedVisits || []).map((v, idx, arr) => transformVisit(v, idx, arr));

                // Знаходимо точку з isDefaultUnload серед visits
                let foundUnloadVisit = visitsData.find(v => v.isDefaultUnload);
                if (!foundUnloadVisit) {
                    foundUnloadVisit = completedData.find(v => v.isDefaultUnload);
                }

                // Прибираємо цю точку з обох списків
                const visitsDataWithoutUnload = visitsData.filter(v => !v.isDefaultUnload);
                const completedDataWithoutUnload = completedData.filter(v => !v.isDefaultUnload);

                // Якщо після переходу з іншої сторінки був переданий idCheckpoint,
                // переміщаємо його з visits у completed (або навпаки) — логіка, яка вже була.
                // Налаштуємо з урахуванням, що ми вже відфільтрували isDefaultUnload.
                if (idCheckpoint) {
                    setCheckpointsMain(visitsDataWithoutUnload.filter((visit) => visit.id !== idCheckpoint));
                    setCheckpointsMainCompleted(
                        completedDataWithoutUnload.concat(
                            visitsDataWithoutUnload.filter((visit) => visit.id === idCheckpoint)
                        )
                    );
                } else {
                    setCheckpointsMain(visitsDataWithoutUnload);
                    setCheckpointsMainCompleted(completedDataWithoutUnload);
                }

                // Зберігаємо точку з isDefaultUnload
                setUnloadCheckpoint(foundUnloadVisit || null);
            } else if (response.status === 401) {
                setErrorMessage('Unauthorized access. Please log in again.');
            } else if (response.status === 404) {
                setErrorMessage('Route not found.');
            } else {
                setErrorMessage('Failed to fetch route data.');
            }
        } catch (error) {
            setErrorMessage('An error occurred while fetching the route. Please try again.');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (checkpointsMain.length > 0 && data?.id) {
            setData(checkpointsMain.filter((item) => item.id === data.id)?.[0]);
        }
    }, [checkpointsMain]);

    useEffect(() => {
        fetchRoute();
    }, [idRoute]);

    const handleConfirm = () => {
        setModalVisible(false);
        navigation.navigate("ChooseCarPage");
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    const handleFinishRoutePress = () => {
        setFinishModalVisible(true);
    };

    const handleFinishConfirm = async () => {
        setFinishModalVisible(false);
        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                setErrorMessage('Authentication token is missing. Please log in again.');
                return;
            }
            const finishResp = await fetch(serverUrlApi + `routes/${idRoute}/finish`, {
                method: 'PATCH',
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (finishResp.status === 200) {
                navigation.navigate("RoutesPage", {idRoute});
                await SecureStore.deleteItemAsync('idRoute');
            } else {
                setErrorMessage('Failed to finish route. Please try again.');
            }
        } catch (error) {
            setErrorMessage('An error occurred while finishing the route. Please try again.');
        }
    };

    const handleFinishCancel = () => {
        setFinishModalVisible(false);
    };

    // Оновлюємо, якщо змінюється причина зміни маршруту
    useEffect(() => {
        switch (routeChangeReason) {
            case 1:
            case 2:
            case 3:
                fetchRoute();
                break;
            default:
                break;
        }
    }, [routeChangeReason]);

    return (
        <View style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.navigate('RoutesPage')}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary}/>
                        <Text style={styles.backText}> Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.routeDescriptionButtonFinish}
                        onPress={handleFinishRoutePress}
                    >
                        <Text style={styles.routeDescriptionTextFinish}>Finish the route</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.routeDescriptionButton}
                        onPress={() =>
                            navigation.navigate('RouteDescriptionPage', {
                                idRoute: routeDetails.id,
                                name: routeDetails.name
                            })
                        }
                    >
                        <Text style={styles.routeDescriptionText}>Route description</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary}/>
                ) : (
                    <>
                        {errorMessage ? (
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        ) : (
                            <>
                                <Text style={styles.titleRed}>
                                    Started <Text style={styles.title}>{routeDetails.name}</Text>
                                </Text>

                                <View style={styles.routeDetailsContainer}>
                                    <Text style={styles.routeDetails}>Start date: {routeDetails.startDate}</Text>
                                    <Text style={styles.routeDetails}>
                                        Route duration: {routeDetails.duration || 'N/A'}
                                    </Text>
                                    <Text style={styles.routeDetails}>End date: {routeDetails.endDate}</Text>
                                </View>

                                {unloadCheckpoint && (
                                    <View style={styles.unloadSection}>
                                        <Text style={styles.unloadSectionTitle}>
                                            Default Unload Point:
                                        </Text>
                                        <CheckpointItem
                                            onPress={() => {
                                                setData(unloadCheckpoint);
                                                navigation.navigate('CheckpointViewPage', {
                                                    last: checkpointsMain.length === 0 && checkpointsMainCompleted.length === 0,
                                                    idCheckpoint: unloadCheckpoint.id,
                                                    routeName: routeDetails.name,
                                                    idRoute: routeDetails.id,
                                                    startDate: unloadCheckpoint.startDate
                                                });
                                            }}
                                            disabled={false}
                                            checkpoint={unloadCheckpoint}
                                            index={unloadCheckpoint.count}
                                        />
                                    </View>
                                )}

                                <FlatList
                                    data={checkpointsMain}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({item}) => (
                                        <CheckpointItem
                                            onPress={() => {
                                                setData(item);
                                                navigation.navigate('CheckpointViewPage', {
                                                    last: checkpointsMain.length === 1,
                                                    idCheckpoint: item.id,
                                                    routeName: routeDetails.name,
                                                    idRoute: routeDetails.id,
                                                    startDate: item.startDate
                                                });
                                            }}
                                            disabled={false}
                                            checkpoint={item}
                                            index={item.count}
                                        />
                                    )}
                                    contentContainerStyle={styles.checkpointsList}
                                    style={styles.flatList}
                                />

                                {/* Список виконаних точок */}
                                <View style={styles.completedContainer}>
                                    <Text style={styles.completedText}>
                                        Completed: ({checkpointsMainCompleted.length})
                                    </Text>
                                </View>
                                {checkpointsMainCompleted.length !== 0 && (
                                    <FlatList
                                        data={checkpointsMainCompleted}
                                        keyExtractor={(item) => item.id}
                                        renderItem={({item}) => (
                                            <CheckpointItem
                                                onPress={() => navigation.navigate('CheckpointViewPage', {
                                                    last: checkpointsMain.length === 1,
                                                    idCheckpoint: item.id,
                                                    data: item,
                                                    routeName: routeDetails.name,
                                                    idRoute: routeDetails.id
                                                })}
                                                disabled={true}
                                                checkpoint={item}
                                                index={item.count}
                                            />
                                        )}
                                        contentContainerStyle={styles.checkpointsList}
                                        style={styles.flatList}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </View>

            <BottomNavigationMenu navigation={navigation} activeTab="Route"/>

            {/* Modal for Starting a route */}
            <UniversalModal
                visible={modalVisible}
                title="Are you sure want to start a route?"
                description='In order not to start a new route, but only to view it, you can return to the list of routes and click on "view route"'
                confirmText="Confirm"
                cancelText="Cancel"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />

            {/* Modal for Finishing a route */}
            <UniversalModal
                visible={finishModalVisible}
                title="Are you sure you want to finish the route?"
                description="If you confirm, the route will be completed and you won't be able to continue it."
                confirmText="Confirm"
                cancelText="Cancel"
                onConfirm={handleFinishConfirm}
                onCancel={handleFinishCancel}
            />
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
        padding: 20,
        paddingBottom: 0,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontSize: Fonts.f14,
        color: colors.textPrimary,
    },
    routeDescriptionButton: {
        backgroundColor: withAlpha(colors.primary, '20'),
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    routeDescriptionButtonFinish: {
        backgroundColor: withAlpha(colors.destructive, '20'),
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    routeDescriptionText: {
        color: colors.primary,
        fontSize: Fonts.f16,
        fontWeight: '600',
    },
    routeDescriptionTextFinish: {
        color: colors.destructive,
        fontSize: Fonts.f12,
        fontWeight: '600',
    },
    errorText: {
        color: colors.destructive,
        fontSize: Fonts.f14,
        marginBottom: 10,
        textAlign: 'center',
    },
    title: {
        fontSize: Fonts.f20,
        color: colors.primary,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    titleRed: {
        fontSize: Fonts.f20,
        color: colors.destructive,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    routeDetailsContainer: {
        marginBottom: 20,
    },
    routeDetails: {
        fontSize: Fonts.f12,
        color: colors.textSecondary,
        marginBottom: 6,
    },
    checkpointsList: {
        flexGrow: 1,
        paddingLeft: 12,
        paddingRight: 10,
        paddingBottom: 24,
    },
    flatList: {
        marginLeft: -20,
        marginRight: -20,
    },
    completedContainer: {
        padding: 10,
    },
    completedText: {
        fontSize: Fonts.f14,
        color: colors.primary,
        fontWeight: 'bold',
    },
    unloadSection: {
        marginBottom: 20,
    },
    unloadSectionTitle: {
        color: colors.primary,
        fontSize: Fonts.f14,
        fontWeight: 'bold',
    },
});

export default RouteCheckpointsPageSelect;
